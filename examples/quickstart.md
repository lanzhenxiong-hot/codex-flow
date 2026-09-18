# Quick Start Example

This walkthrough shows how to use codex-flow in a real project.

## Scenario: Automating a Weekly Code Cleanup

You have a Node.js project where you want to:
1. Run all tests
2. Let Codex identify and fix any linting issues
3. Update the changelog
4. Create a git commit

## Step 1: Create Your Flow

```yaml
# weekly-cleanup.flow.yaml
name: weekly-cleanup
description: "Automated weekly code maintenance"
variables:
  branch: "main"

steps:
  - id: test
    name: "Run Tests"
    type: shell
    command: "npm test"
    timeout: 180000

  - id: fix-lint
    name: "Fix Lint Issues"
    type: codex
    prompt: "Run the linter, identify all issues, and fix them. Only make minimal changes to pass lint."

  - id: changelog
    name: "Update Changelog"
    type: codex
    prompt: "Read git log from the last 7 days and append a changelog entry to CHANGELOG.md."

  - id: commit
    name: "Commit Changes"
    type: shell
    command: "git add -A && git commit -m 'chore: weekly cleanup'"
```

## Step 2: Run It

```bash
codex-flow run weekly-cleanup.flow.yaml
```

Expected output:

```
🚀 Flow: weekly-cleanup — Automated weekly code maintenance
   Steps: 4

  [Run Tests] starting...
  [Run Tests] ✓ done (12.3s)
  [Fix Lint Issues] starting...
  [Fix Lint Issues] ✓ done (45.1s)
  [Update Changelog] starting...
  [Update Changelog] ✓ done (8.7s)
  [Commit Changes] starting...
  [Commit Changes] ✓ done (1.2s)

✅ Flow completed in 67.3s

  ✓ Run Tests
  ✓ Fix Lint Issues
  ✓ Update Changelog
  ✓ Commit Changes
```

## Step 3: Use in CI (Optional)

Add to your `.github/workflows/cleanup.yml`:

```yaml
name: Weekly Cleanup
on:
  schedule:
    - cron: "0 2 * * 1"  # Monday 2am

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm install -g codex-flow
      - run: codex-flow run weekly-cleanup.flow.yaml
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```
