# codex-flow

**YAML-driven workflow engine for multi-step development tasks, powered by [Codex](https://openai.com/codex).**

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![Tests](https://img.shields.io/badge/tests-10%20passing-brightgreen.svg)
![Flows](https://img.shields.io/badge/flow_templates-11-orange.svg)

## What is codex-flow?

`codex-flow` lets you define multi-step development workflows in a simple YAML file and execute them with a single command. Each step can invoke Codex (for code generation, analysis, refactoring) or run shell commands, HTTP requests, or conditional logic — all orchestrated in sequence or parallel.

Think of it as **Makefile meets AI agent**: deterministic orchestration with intelligent execution.

## Why?

- **Stop context-switching** between multiple Codex sessions for a single task
- **Make workflows reusable and shareable** — a `.flow.yaml` file is all you need
- **Combine AI + deterministic steps** — let Codex think, let shell scripts act

## Quick Start

```bash
# Install
npm install -g codex-flow

# Or use directly via npx (no install needed)
npx codex-flow run my-flow.flow.yaml

# Validate your Codex CLI is working
codex --version

# Generate a starter template
codex-flow init my-first-flow

# Run it
codex-flow run my-first-flow.flow.yaml

# Override variables at runtime
codex-flow run flows/release.flow.yaml --var version=1.5.0
```

## Example Output

```
$ codex-flow run flows/release.flow.yaml --var version=1.2.0

🚀 Flow: release — Automated software release workflow
   Steps: 7

  [Check Working Tree] starting...
  [Check Working Tree] ✓ done (1.2s)
  [Run Test Suite] starting...
  [Run Test Suite] ✓ done (23.4s)
  [Bump Version] starting...
  [Bump Version] ✓ done (8.7s)
  [Generate Changelog] starting...
  [Generate Changelog] ✓ done (12.1s)
  [Create Git Tag] starting...
  [Create Git Tag] ✓ done (0.8s)
  [Push to Remote] starting...
  [Push to Remote] ✓ done (3.2s)
  [Publish Package] starting...
  [Publish Package] ✓ done (15.6s)

✅ Flow completed in 65.1s

  ✓ Check Working Tree
  ✓ Run Test Suite
  ✓ Bump Version
  ✓ Generate Changelog
  ✓ Create Git Tag
  ✓ Push to Remote
  ✓ Publish Package
```

## Flow File Format

```yaml
name: my-workflow
description: "What this workflow does"
variables:
  project: "my-app"
  target: "production"

steps:
  - id: step-1
    name: "Human-readable name"
    type: codex          # codex | shell | http | wait | condition
    prompt: "Do something with {{project}}"

  - id: step-2
    name: "Run tests"
    type: shell
    command: "npm test"
    timeout: 120000

  - id: step-3
    name: "Deploy"
    type: shell
    command: "deploy.sh"
    parallel: true      # runs in parallel with adjacent parallel steps

  - id: step-4
    name: "Cleanup"
    type: shell
    command: "rm -rf /tmp/build"
    retry:
      maxAttempts: 3
      backoff: exponential
```

### Step Types

| Type | Description |
|------|-------------|
| `codex` | Invokes Codex CLI with a prompt; captures output as variable |
| `shell` | Runs a shell command (bash/powershell) |
| `http` | Makes an HTTP request (GET/POST/PUT/DELETE) |
| `wait` | Pauses for N milliseconds |
| `condition` | Evaluates an expression; subsequent steps can be gated |

### Variable Interpolation

Use `{{variable_name}}` in any `prompt`, `command`, or `content` field. Variables are:
1. Defined in the top-level `variables` block
2. Overridden via `--var key=value`
3. Produced by any step's `output.saveAs`

### Parallel Execution

Consecutive steps marked with `parallel: true` form a parallel group and execute simultaneously:

```yaml
steps:
  - id: test-unit
    name: "Unit Tests"
    type: shell
    command: "npm run test:unit"
    parallel: true

  - id: test-integration
    name: "Integration Tests"
    type: shell
    command: "npm run test:integration"
    parallel: true

  - id: lint
    name: "Lint"
    type: shell
    command: "npm run lint"
    parallel: true

  - id: report
    name: "Generate Report"
    type: codex
    prompt: "Summarize test results and flag failures"
```

## Built-in Flow Templates

| Template | Description |
|----------|-------------|
| `flows/release.flow.yaml` | Full release: test → bump → changelog → tag → publish |
| `flows/code-review.flow.yaml` | PR review: fetch diff → analyze → summarize → post |
| `flows/doc-gen.flow.yaml` | Documentation: scan → generate README → add docstrings |
| `flows/debug.flow.yaml` | Debug: reproduce → root cause → fix → verify |
| `flows/security-audit.flow.yaml` | Security: scan deps → static analysis → hardening → report |
| `flows/migration.flow.yaml` | Migration: assess → plan → execute → verify → cleanup |
| `flows/perf-optimization.flow.yaml` | Performance: profile → identify bottlenecks → optimize → benchmark |

## CLI Commands

```bash
# Run a flow
codex-flow run <file> [--var k=v] [--continue] [--quiet]

# Validate without executing
codex-flow validate <file>

# Generate a starter template
codex-flow init [name]
```

## Architecture

```
┌─────────────────────────────────────────────┐
│                  CLI (commander)             │
├─────────────────────────────────────────────┤
│              FlowEngine                      │
│  ┌───────────┐  ┌──────────┐  ┌─────────┐ │
│  │  Parser   │→ │ Executor │→ │  Engine │ │
│  │ (YAML→)  │  │ (steps)  │  │ (orch.) │ │
│  └───────────┘  └──────────┘  └─────────┘ │
├─────────────────────────────────────────────┤
│         Codex CLI  │  Shell  │  HTTP        │
└─────────────────────────────────────────────┘
```

## Requirements

- Node.js >= 18
- [Codex CLI](https://github.com/openai/codex) installed and authenticated
- Optional: `gh` CLI for code-review flows

## Contributing

1. Fork the repo
2. Create a feature branch
3. Run `npm test` to ensure tests pass
4. Submit a PR

## License

[MIT](./LICENSE)

## Related

- [Codex CLI](https://github.com/openai/codex) — The AI coding agent that powers codex-flow
- [OpenAI API](https://platform.openai.com/) — API access

## Roadmap

- [ ] Flow file validation with autocomplete
- [ ] Plugin system for custom step types
- [ ] Flow file sharing/registry
- [ ] Web dashboard for flow execution history
- [ ] GitHub Action for CI integration
- [ ] Template marketplace
