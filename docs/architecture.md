# Architecture

## Overview

codex-flow is a workflow engine that parses YAML flow definitions and executes steps
sequentially or in parallel. Steps can invoke Codex (AI coding agent), run shell
commands, make HTTP requests, or evaluate conditions.

## Core Modules

```
src/
├── index.ts        # CLI entry point (commander)
├── types.ts        # TypeScript type definitions
├── parser.ts       # YAML → FlowConfig (zod validation)
├── executor.ts     # Step execution (codex/shell/http/wait/condition)
└── engine.ts       # Flow orchestration (sequencing, parallel, error handling)
```

## Execution Model

```
FlowConfig (parsed YAML)
       │
       ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Parser    │────→│  FlowEngine  │────→│    Executor     │
│  (validate) │     │ (orchestrate)│     │  (run steps)    │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                  │
                              ┌───────────────────┼──────────────┐
                              ▼           ▼       ▼              ▼
                          Codex CLI    Shell    HTTP        Condition
```

## Variable Flow

1. **Input variables**: Defined in `variables` block or passed via `--var`
2. **Interpolation**: `{{var_name}}` in prompts/commands is replaced before execution
3. **Output variables**: Steps with `output.saveAs` capture their result into a variable
4. **Chaining**: Subsequent steps can reference earlier steps' outputs

## Parallel Execution

Consecutive steps with `parallel: true` are grouped and executed via `Promise.all`.
The engine collects the next "batch" — either a single non-parallel step or a group
of parallel steps — and executes them before moving on.

## Error Handling

- **Stop on error** (default): First failed step aborts the flow
- **Continue mode** (`--continue`): Failed steps are logged, execution continues
- **Retry**: Steps with `retry` config are retried with fixed or exponential backoff
- **Timeout**: Each step has a configurable timeout (default 120s, 300s for codex)
