# Parallel Test Execution

Run multiple test suites in parallel for faster feedback:

```yaml
# parallel-tests.flow.yaml
name: parallel-tests
description: "Run all test suites in parallel, then aggregate results"

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

  # This step waits for all parallel steps above to complete
  - id: report
    name: "Generate Report"
    type: codex
    prompt: "Summarize the test results. If all passed, say 'All checks passed ✅'. If any failed, list the failures with suggested fixes."
```

The 5 test/lint steps run simultaneously, cutting total wall time from ~10min to ~5min.
The final `report` step only starts after all parallel steps complete.
