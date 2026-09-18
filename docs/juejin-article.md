# 用 YAML + Codex 自动化你的开发工作流：codex-flow 设计思路与实战

> 本文介绍一个开源工具 codex-flow：用 YAML 声明式定义多步开发流程，让 OpenAI Codex 负责"思考"（代码生成、分析、重构），Shell 命令负责"执行"（测试、部署、构建），一条命令跑完整个流程，告别在 AI 对话和终端之间反复横跳。

## 痛点：Codex 很聪明，但它是"单轮"的

如果你日常使用 Codex CLI，大概率经历过这样的流程——

```
1. 打开 Codex："帮我修一下 lint 错误"
2. 等它输出代码
3. 复制粘贴到文件
4. 切换到终端：npm test
5. 看到 3 个测试挂了
6. 再打开 Codex："测试挂了，错误是 xxx，帮我修"
7. 复制粘贴
8. 再跑测试
9. 终于全过了
10. 打开 Codex："根据 git log 生成 changelog"
11. 复制粘贴到 CHANGELOG.md
12. 手动 git tag + npm publish
```

12 步操作，其中 6 步是"复制粘贴 + 切换窗口"。Codex 每一步都很强，但**串联起来全靠人肉**。

更痛苦的是复杂任务：一次完整的发版、一次跨文件的迁移、一轮安全审计——每步的上下文需要手动传递给下一步，AI 不知道上一步做了什么，你得当"人肉胶水层"。

**核心矛盾**：Codex 是强大的单步执行器，但真实开发任务是**多步编排**问题。

## 设计思路：Makefile 的 AI 升级版

我的解法很直接：如果每一步可以是"让 Codex 做某件事"或"跑一条 Shell 命令"，那整个流程不就是个 Makefile 吗？

只不过 Makefile 的 target 从 `gcc -o app main.c` 变成了：

```yaml
- type: codex
  prompt: "Fix all lint errors in the project"
```

于是有了 codex-flow：**用 YAML 声明式定义工作流，引擎自动编排执行**。

### 一个完整的 Flow 文件长这样

```yaml
# release.flow.yaml
name: release
description: "Automated software release workflow"
variables:
  version: "1.2.0"

steps:
  - id: run-tests
    name: "Run Test Suite"
    type: shell
    command: "npm test"
    timeout: 120000

  - id: bump-version
    name: "Bump Version"
    type: codex
    prompt: "Update package.json version to {{version}}. Update CHANGELOG.md."

  - id: generate-changelog
    name: "Generate Changelog"
    type: codex
    prompt: |
      Read git log since last tag.
      Generate CHANGELOG entry for v{{version}}.
      Group into: Features, Bug Fixes, Breaking Changes.

  - id: create-tag
    name: "Create Git Tag"
    type: shell
    command: "git tag -a v{{version}} -m 'Release v{{version}}'"

  - id: publish
    name: "Publish"
    type: shell
    command: "npm publish --access public"
```

执行：

```bash
$ codex-flow run release.flow.yaml --var version=1.2.0

🚀 Flow: release — Automated software release workflow
   Steps: 5

  [Run Test Suite] starting...
  [Run Test Suite] ✓ done (23.4s)
  [Bump Version] starting...
  [Bump Version] ✓ done (8.7s)
  [Generate Changelog] starting...
  [Generate Changelog] ✓ done (12.1s)
  [Create Git Tag] starting...
  [Create Git Tag] ✓ done (0.8s)
  [Publish] starting...
  [Publish] ✓ done (15.6s)

✅ Flow completed in 60.6s
```

60 秒，5 步全部自动完成。中间不需要你复制粘贴任何东西。

## 架构设计

```
┌─────────────────────────────────────────────────────┐
│                   CLI (commander)                    │
│         codex-flow run / validate / init             │
├─────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────┐    ┌──────────────┐    ┌───────────┐ │
│  │  Parser  │───→│ FlowEngine   │───→│ Executor  │ │
│  │          │    │              │    │           │ │
│  │ YAML→   │    │ Orchestrate  │    │ Run steps │ │
│  │ FlowConfig│   │ Sequence     │    │ (5 types) │ │
│  │ (zod)   │    │ Parallel     │    │           │ │
│  └──────────┘    │ Error handling│  └─────┬─────┘ │
│                  └──────────────┘         │       │
├────────────────────────────────────────────┼───────┤
│                  Step Backends             │       │
│     ┌───────┬────────┬──────┬───────┐     │       │
│     ▼       ▼        ▼      ▼       ▼     │       │
│  Codex CLI Shell   HTTP   Wait  Condition │       │
│  (AI)     (exec)  (fetch)  (sleep) (eval) │       │
└────────────────────────────────────────────┴───────┘
```

### 三层分离

**Parser 层**（`src/parser.ts`）

用 Zod 做运行时校验，YAML 文件进来 → 类型安全的 `FlowConfig` 对象出去。校验包括：
- 必填字段检查（name, steps）
- 步骤类型枚举（codex/shell/http/wait/condition）
- 步骤 ID 唯一性
- Retry 配置合法性

```typescript
const StepSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["codex", "shell", "http", "wait", "condition"]),
  prompt: z.string().optional(),
  command: z.string().optional(),
  timeout: z.number().optional(),
  parallel: z.boolean().optional().default(false),
  retry: z.object({
    maxAttempts: z.number().int().min(1).max(10),
    backoff: z.enum(["fixed", "exponential"]).optional(),
  }).optional(),
});
```

**Engine 层**（`src/engine.ts`）

核心是 `run()` 方法，实现顺序/并行调度：

```typescript
async run(flow: FlowConfig): Promise<FlowResult> {
  let i = 0;
  while (i < flow.steps.length) {
    // 收集当前批次（单个步骤或并行组）
    const batch = this.collectParallelGroup(flow.steps, i);

    if (batch.length > 1) {
      // 并行执行
      const results = await Promise.all(
        batch.map(step => executeStep(step, context))
      );
    } else {
      // 顺序执行
      const result = await executeStep(batch[0], context);
    }

    // 错误处理：默认 stop on error，可配置 continue
    i += batch.length;
  }
}
```

**Executor 层**（`src/executor.ts`）

每种步骤类型的具体执行逻辑：

| 类型 | 实现方式 | 典型场景 |
|------|---------|---------|
| `codex` | 调用 `codex exec` CLI，传入 prompt | 代码生成、分析、重构 |
| `shell` | `execSync` 执行命令 | 测试、构建、部署 |
| `http` | `fetch` API 发请求 | 调用 Webhook、API |
| `wait` | `setTimeout` | 等待服务启动 |
| `condition` | `new Function` 求值表达式 | 条件分支 |

## 实战：三个真实场景

### 场景一：PR Code Review

以前 Code Review 是：打开 PR → 肉眼扫 diff → 评论。用 codex-flow 可以自动化"初筛"：

```yaml
name: code-review
description: "AI-powered initial code review"
variables:
  pr_number: "42"
  focus: "security and performance"

steps:
  - id: fetch-diff
    name: "Fetch PR Diff"
    type: shell
    command: "gh pr diff {{pr_number}}"
    output:
      saveAs: pr_diff

  - id: analyze
    name: "Deep Analysis"
    type: codex
    prompt: |
      Review this PR diff. Focus on {{focus}}.
      For each finding provide:
      - Severity: critical / warning / info
      - File and line
      - Description
      - Suggested fix (code snippet)

      ```
      {{pr_diff}}
      ```

  - id: summarize
    name: "Generate Summary"
    type: codex
    prompt: |
      Based on the analysis above, write a PR review comment
      (max 10 bullets). Be specific and actionable.
      A senior engineer should be able to act on each point.

  - id: post
    name: "Post to PR"
    type: shell
    command: "gh pr review {{pr_number}} --comment --body-file review.md"
```

效果：PR 提交后 30 秒内就有 AI 初筛评论，你只需要审核"critical"级别的发现。

### 场景二：安全审计 + 加固

```yaml
name: security-audit
variables:
  target: "src/"

steps:
  - id: npm-audit
    name: "Dependency Audit"
    type: shell
    command: "npm audit --json 2>/dev/null"
    output:
      saveAs: audit_result

  - id: static-analysis
    name: "Code Security Scan"
    type: codex
    prompt: |
      Security audit on {{target}}. Look for:
      1. Injection (SQL, command, XSS)
      2. Auth/Authz bypass patterns
      3. Sensitive data in code (keys, tokens)
      4. Missing input validation

      Report with severity, file:line, and fix.

  - id: hardening
    name: "Generate Hardening Script"
    type: codex
    prompt: |
      Based on findings, generate:
      1. Shell script for quick wins (permissions, env sanitization)
      2. Code patches for critical/high issues
      3. Security checklist for the team

  - id: report
    name: "Executive Report"
    type: codex
    prompt: |
      Write a professional security audit report:
      - Executive summary (for non-technical stakeholders)
      - Findings table
      - Risk assessment (likelihood × impact)
      - Action plan: immediate / 30-day / 90-day
```

### 场景三：代码迁移（CommonJS → ESM）

```yaml
name: migration
variables:
  from: "CommonJS"
  to: "ESM"

steps:
  - id: assess
    name: "Assess Scope"
    type: codex
    prompt: |
      Analyze the codebase. Determine:
      1. All files affected by {{from}} → {{to}} migration
      2. Dependencies that need updating
      3. Config changes (package.json, tsconfig, bundler)
      4. Risk per file (high/medium/low)

  - id: plan
    name: "Migration Plan"
    type: codex
    prompt: |
      Create ordered migration plan (lowest risk first):
      - Each step: what to change, how to verify, rollback strategy
      - Total estimated time

  - id: execute
    name: "Execute"
    type: codex
    prompt: |
      Execute the migration plan incrementally:
      1. package.json: add "type": "module"
      2. Convert require() → import
      3. Fix __dirname/__filename → import.meta.url
      4. Update any .cjs → .mjs where needed

      Make minimal changes. Preserve behavior.

  - id: verify
    name: "Verify"
    type: shell
    command: "npm test && npx tsc --noEmit"
    timeout: 120000

  - id: cleanup
    name: "Cleanup"
    type: codex
    prompt: "Remove leftover artifacts: unused requires, mixed module syntax, etc."
```

## 并行执行：把 10 分钟压缩到 5 分钟

如果你的项目有多个独立的测试/检查步骤，标记 `parallel: true` 让它们并发跑：

```yaml
steps:
  - id: unit
    name: "Unit Tests"
    type: shell
    command: "npm run test:unit"
    parallel: true
    timeout: 120000

  - id: integration
    name: "Integration Tests"
    type: shell
    command: "npm run test:integration"
    parallel: true
    timeout: 180000

  - id: e2e
    name: "E2E Tests"
    type: shell
    command: "npm run test:e2e"
    parallel: true
    timeout: 300000

  - id: typecheck
    name: "Type Check"
    type: shell
    command: "npx tsc --noEmit"
    parallel: true
    timeout: 60000

  - id: lint
    name: "Lint"
    type: shell
    command: "npm run lint"
    parallel: true
    timeout: 60000

  # 这步等上面 5 个全部完成后才执行
  - id: report
    name: "Summary"
    type: codex
    prompt: "Summarize all test/check results. Flag any failures."
```

引擎内部用 `Promise.all` 并发执行同一组 `parallel: true` 的步骤，全部完成后才进入下一步。实测 5 个步骤从串行 ~10min 降到并行 ~5min（取决于最慢的那个）。

## 变量系统：步骤间的数据管道

Flow 的核心能力之一是**步骤间传递数据**。三种方式：

### 1. 全局变量

```yaml
variables:
  version: "1.0.0"
  registry: "npm"
```

任何步骤中用 `{{version}}` 引用。

### 2. 运行时覆盖

```bash
codex-flow run release.flow.yaml --var version=2.0.0
```

### 3. 步骤输出 → 下一步输入

```yaml
steps:
  - id: analyze
    name: "Analyze"
    type: codex
    prompt: "List all TODO comments in the codebase"
    output:
      saveAs: todo_list    # ← 把输出存到变量

  - id: fix
    name: "Fix TODOs"
    type: codex
    prompt: |
      Implement the following TODOs:
      {{todo_list}}        # ← 下一步引用上一步的输出
```

这形成了一个**数据管道**：每一步的输出可以是下一步的输入，整条流水线自动流转。

## 编辑器体验：JSON Schema 自动补全

写 YAML 最怕手滑拼错字段名。codex-flow 内置了完整的 JSON Schema：

```json
// .vscode/settings.json
{
  "yaml.schemas": {
    "./schema.json": "*.flow.yaml"
  }
}
```

配置后，在 VS Code / Cursor 中编辑 `.flow.yaml` 文件时：
- 输入 `type:` 后自动补全 `codex` / `shell` / `http` / `wait` / `condition`
- 输入 `retry.` 后补全 `maxAttempts` / `delayMs` / `backoff`
- 拼错字段名直接红线

## 内置模板一览

| 模板 | 步骤数 | 场景 |
|------|--------|------|
| `release` | 7 | 完整发版：测试→bump→changelog→tag→push→publish |
| `code-review` | 4 | PR 审查：取 diff→AI 分析→总结→发评论 |
| `doc-gen` | 4 | 文档生成：扫描→README→docstring→校验 |
| `debug` | 4 | 调试：复现→根因→修复→验证 |
| `security-audit` | 4 | 安全：依赖扫描→代码审计→加固→报告 |
| `migration` | 5 | 迁移：评估→计划→执行→验证→清理 |
| `perf-optimization` | 4 | 性能：profiling→定位→优化→基准测试 |
| `a-b-test` | 4 | A/B 测试：设计→实现→统计→报告模板 |
| `deploy-checklist` | 4 | 部署：预检→canary→全量→验证 |
| `competitive-analysis` | 3 | 竞品：情报→差距→策略建议 |
| `onboarding-dev` | 4 | 新人：clone→架构讲解→首个任务→验证 |

## 技术选型思考

**为什么用 YAML 而不是 JSON/TOML？**
- 开发工作流配置天然适合 YAML 的多行字符串（prompt 经常是长文本）
- 注释支持（`# 这一步是做什么的`）
- 生态成熟，所有语言都有解析库

**为什么调 Codex CLI 而不是直接调 API？**
- Codex CLI 已经处理了认证、重试、流式输出
- 用户可以自由选择模型（gpt-4, gpt-5 等）
- 保持与 Codex 生态的一致性

**为什么用 TypeScript？**
- 类型安全（FlowConfig 从解析到执行全链路类型）
- 与 Node.js 生态无缝集成
- 团队熟悉度高，维护成本低

**Zod 做校验而不是手写 if-else？**
- 校验逻辑和类型定义合一
- 错误信息自动格式化（`steps[2].type: Invalid enum value`）
- 未来做 JSON Schema 导出零成本

## 路线图

| 版本 | 特性 | 状态 |
|------|------|------|
| v0.1.0 | 核心引擎 + 5 种步骤 + 11 个模板 | ✅ 已发布 |
| v0.2.0 | 插件系统（自定义步骤类型） | 🔨 开发中 |
| v0.3.0 | Flow Registry（社区模板市场） | 📋 规划中 |
| v0.4.0 | GitHub Action（CI 中直接跑 flow） | 📋 规划中 |
| v0.5.0 | Web Dashboard（执行历史 + 实时监控） | 📋 规划中 |

## 快速开始

```bash
# 安装（需要 Node.js >= 18 + Codex CLI）
npm install -g codex-flow

# 生成模板
codex-flow init my-task

# 编辑 my-task.flow.yaml，定义你的步骤

# 验证
codex-flow validate my-task.flow.yaml

# 执行
codex-flow run my-task.flow.yaml
```

或者不安装，直接用 npx：

```bash
npx codex-flow run your-flow.flow.yaml
```

## 项目地址

**GitHub**: [github.com/lanzhenxiong-hot/codex-flow](https://github.com/lanzhenxiong-hot/codex-flow)

MIT 开源。欢迎：
- ⭐ Star 支持
- 🍴 Fork 后提 PR（新模板、bug fix、文档）
- 🐛 [Issue 反馈](https://github.com/lanzhenxiong-hot/codex-flow/issues)

特别欢迎的贡献方向：
1. 新的 flow 模板（你日常重复做的事情）
2. 平台适配（Windows PowerShell 兼容性、macOS zsh 支持）
3. 插件系统实现（[Issue #1](https://github.com/lanzhenxiong-hot/codex-flow/issues/1)）

---

> 如果这篇文章对你有帮助，欢迎 Star 仓库。有问题或想法欢迎在评论区讨论，或者直接在仓库提 Issue。
