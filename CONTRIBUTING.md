# Contributing to codex-flow

Thanks for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/your-username/codex-flow.git
cd codex-flow
npm install
```

## Running Locally

```bash
# Build
npm run build

# Run in dev mode (no build needed)
npm run dev -- run flows/release.flow.yaml

# Run tests
npm test
```

## Requirements

- Node.js >= 18
- [Codex CLI](https://github.com/openai/codex) installed and authenticated
- For code-review flows: `gh` CLI

## Writing New Flow Templates

Flow templates live in `flows/`. Each is a valid `.flow.yaml` file:

```yaml
name: my-template
description: "What it does"
variables:
  some_var: "default"
steps:
  - id: step1
    name: "Step One"
    type: codex
    prompt: "Your prompt here"
```

When submitting a new template, please:
1. Validate it with `npx codex-flow validate flows/my-template.flow.yaml`
2. Add a brief description in the README's template table
3. Include example usage in the template file comments

## Writing Plugins (Step Types)

Custom step types can be registered via the plugin API (coming soon). For now,
you can extend functionality by:
- Using `shell` steps to wrap any CLI tool
- Using `http` steps to call external APIs
- Using `codex` steps with custom system prompts

## Code Style

- TypeScript, strict mode
- ES Modules (`import`/`export`)
- No default exports
- Use `node:` prefix for built-in imports

## Pull Request Process

1. Fork and create a feature branch
2. Make your changes with tests
3. Ensure `npm test` and `npx tsc --noEmit` pass
4. Submit a PR with a clear description

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
