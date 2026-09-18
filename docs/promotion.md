# codex-flow 推广文案包

> 以下文案可直接复制使用，已针对各平台风格调整。

---

## 1. 即刻 (Jike)

**标题**: 我做了个工具，让 Codex 帮你自动跑完整个开发流程

**正文**:

受够了在 Codex 和终端之间反复横跳？

做了个工具叫 codex-flow：

用 YAML 定义多步开发流程，一条命令全部跑完。Codex 负责思考（代码生成、分析、重构），Shell 负责执行（测试、部署、构建）。

比如发版流程，以前要手动：
1. 开 Codex → "帮我 bump version"
2. 复制输出到终端
3. 跑测试
4. 再开 Codex → "根据 git log 生成 changelog"
5. 手动打 tag
6. 手动 publish

现在只要：
```bash
codex-flow run release.flow.yaml --var version=1.2.0
```

65 秒自动完成全部 7 步。

内置 11 个模板：发版、Code Review、文档生成、Debug、安全审计、代码迁移、性能优化、A/B 测试、部署检查、新人 Onboarding、竞品分析。

开源：github.com/lanzhenxiong-hot/codex-flow

MIT 协议，欢迎 PR。

---

## 2. V2EX

**节点**: 程序员

**标题**: [开源] codex-flow - 用 YAML 编排 Codex 多步开发工作流

**正文**:

分享一个刚开源的工具：codex-flow

**解决什么问题**：用 Codex 做多步开发任务时，需要在 AI 对话和终端之间反复切换，上下文丢失，效率很低。

**怎么用**：

```yaml
# my-task.flow.yaml
name: fix-and-release
steps:
  - id: fix
    type: codex
    prompt: "Fix all lint errors in the project"

  - id: test
    type: shell
    command: "npm test"

  - id: release
    type: codex
    prompt: "Generate changelog and bump version to 1.1.0"

  - id: publish
    type: shell
    command: "npm publish"
```

```bash
$ codex-flow run my-task.flow.yaml

🚀 Flow: fix-and-release
  [Fix] ✓ done (12s)
  [Test] ✓ done (45s)
  [Release] ✓ done (8s)
  [Publish] ✓ done (15s)
✅ Flow completed in 80s
```

**特性**：
- 5 种步骤类型：codex / shell / http / wait / condition
- 变量插值：{{var_name}} 在步骤间传递数据
- 并行执行：标记 parallel: true 的步骤并发运行
- 重试机制：固定/指数退避
- 11 个内置模板
- JSON Schema：VS Code/Cursor 写 YAML 有自动补全

**要求**：Node.js >= 18 + Codex CLI

GitHub: https://github.com/lanzhenxiong-hot/codex-flow

欢迎 Star / Fork / 提 Issue。

---

## 3. 掘金 (Juejin)

**标题**: 用 YAML + Codex 自动化你的开发工作流：codex-flow 设计思路与实战

**摘要**: 介绍如何用 codex-flow 将重复性开发任务（发版、Code Review、安全审计、代码迁移）编排为一条命令执行的自动化流程，核心引擎是 OpenAI Codex。

**正文大纲**（你展开写即可）:

1. **痛点**：Codex 是单轮对话工具，但真实开发任务是多步的
2. **设计**：YAML 声明式 → 解析 → 引擎编排 → 步骤执行
3. **架构**：Parser(zod) → Engine(orchestration) → Executor(5种步骤)
4. **实战**：
   - 发版自动化（完整 demo）
   - PR Code Review（gh CLI + Codex 分析）
   - 安全审计（npm audit + Codex 静态分析 + 加固脚本）
5. **并行执行**：5 个测试套件并发跑，10min → 5min
6. **变量系统**：步骤间数据传递
7. **未来**：插件系统、Flow Registry、GitHub Action

---

## 4. Twitter / X (English)

**Post 1** (announcement):

```
I open-sourced codex-flow 🎉

Define multi-step dev workflows in YAML. Codex does the thinking (code gen, analysis, refactoring), shell commands do the acting.

One command replaces 5+ context switches between AI and terminal.

11 built-in templates: release, code-review, debug, security-audit, migration, A/B testing...

npm install -g codex-flow
github.com/lanzhenxiong-hot/codex-flow
```

**Post 2** (demo, post a screen recording GIF):

```
watching codex-flow run a 7-step release pipeline in 65 seconds:

✓ Check Working Tree
✓ Run Tests
✓ Bump Version (Codex)
✓ Generate Changelog (Codex)
✓ Git Tag
✓ Push
✓ Publish

No context switching. No copy-paste. Just: codex-flow run release.flow.yaml

MIT licensed. Built on OpenAI Codex.
```

---

## 5. Hacker News (English)

**Title**: Show HN: codex-flow – YAML-driven workflow engine for Codex

**Comment**:

> Built this because I was tired of context-switching between Codex sessions and my terminal for every release/migration/audit.

> You define a flow in YAML:
> ```yaml
> steps:
>   - type: codex
>     prompt: "Fix all lint errors"
>   - type: shell
>     command: "npm test"
>   - type: codex
>     prompt: "Generate changelog from git log"
> ```

> Then `codex-flow run release.flow.yaml` executes everything sequentially (or in parallel).

> Core engine is OpenAI Codex CLI. 11 built-in templates. JSON Schema for editor autocomplete. MIT licensed.

> Repo: https://github.com/lanzhenxiong-hot/codex-flow

---

## 6. Reddit (r/OpenAI or r/ClaudeAI)

**Title**: I built a YAML workflow engine that chains multiple Codex sessions automatically

**Body**:

TL;DR: Define multi-step dev tasks in YAML, Codex handles the "thinking" steps, shell handles execution. One command, no context switching.

The problem: Every time I want to do something like "fix lint → run tests → generate changelog → publish", I have to:
1. Open Codex, ask it to fix lint
2. Copy the code changes
3. Run tests in terminal
4. Open Codex again, paste test results
5. Ask it to generate changelog
6. ...repeat

codex-flow collapses all of that into:
```bash
codex-flow run release.flow.yaml
```

It's essentially a Makefile where some steps are "ask an AI to do this" and others are "run this command". Steps can pass data to each other via variables, run in parallel, retry on failure, etc.

Repo: https://github.com/lanzhenxiong-hot/codex-flow

Would love feedback on the flow file format – is the YAML schema intuitive? Any use cases I'm missing?

---

## 7. 提交到 Awesome 列表

目标仓库：
- https://github.com/awesome-openai/awesome-chatgpt → PR 添加到 "Tools" 或 "Code" 分类
- https://github.com/sunnyos/awesome-copilot (或类似 awesome-codex 列表)

PR 格式：
```markdown
- [codex-flow](https://github.com/lanzhenxiong-hot/codex-flow) - YAML-driven workflow engine for multi-step Codex development tasks
```

---

## 推广节奏建议

| 时间 | 平台 | 内容 |
|------|------|------|
| 今天 | GitHub | 仓库已就绪，申请赞助 |
| 今天 | X/Twitter | Post 1 (announcement) |
| 明天 | 即刻 | 中文介绍 + 截图 |
| 后天 | V2EX | 开源分享帖 |
| 第3天 | 掘金 | 技术长文（设计思路） |
| 第4天 | Hacker News | Show HN |
| 第5天 | Reddit | r/OpenAI 讨论帖 |
| 第7天 | X/Twitter | Post 2 (demo GIF) |
| 第10天 | Awesome 列表 | 提交 PR |

**关键**：申请赞助后再发推广，让审核看到仓库有持续活动（star、issue、commit）。
