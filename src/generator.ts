import { execSync } from "node:child_process";

export interface GenerateResult {
  yaml: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are a YAML flow file generator for codex-flow.

Given a natural language description of a development workflow, generate a valid codex-flow YAML file.

RULES:
1. Output ONLY valid YAML (no markdown code fences, no explanations)
2. Must include: name, description, steps array
3. Each step must have: id (kebab-case), name, type
4. Valid types: codex, shell, http, wait, condition
5. Use {{variable_name}} for interpolation
6. Add variables block if the flow benefits from configurable values
7. Use timeout for long-running steps (tests: 120000, builds: 300000)
8. Use parallel: true for independent steps that can run concurrently
9. Use retry for flaky operations (network calls, CI)
10. For codex steps, write detailed, specific prompts that will produce good results
11. For shell steps, use portable commands where possible
12. Keep the flow focused — 3-8 steps is ideal, don't over-engineer
13. The name should be kebab-case (e.g., "auto-release", "ci-pipeline")

EXAMPLE:
Input: "I want to automatically test, build, and deploy my app on every push"
Output:
name: auto-deploy
description: "Automated test-build-deploy pipeline for every push"
variables:
  environment: "production"
  branch: "main"
steps:
  - id: lint
    name: "Lint Check"
    type: shell
    command: "npm run lint"
    timeout: 60000
    parallel: true

  - id: typecheck
    name: "Type Check"
    type: shell
    command: "npx tsc --noEmit"
    timeout: 60000
    parallel: true

  - id: test
    name: "Run Tests"
    type: shell
    command: "npm test"
    timeout: 180000
    parallel: true

  - id: build
    name: "Build"
    type: shell
    command: "npm run build"
    timeout: 120000

  - id: deploy
    name: "Deploy"
    type: shell
    command: "npm run deploy -- --env {{environment}}"
    timeout: 300000
    retry:
      maxAttempts: 3
      backoff: exponential`;

export async function executeCodexGenerate(description: string): Promise<GenerateResult> {
  const userPrompt = `Generate a codex-flow YAML file for this workflow:

${description}

Output the complete YAML file. No explanations, no code fences.`;

  try {
    const cmd = `codex exec --quiet "${escapeForShell(SYSTEM_PROMPT + "\\n\\n" + userPrompt)}"`;
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 120_000,
      cwd: process.cwd(),
    });

    let yaml = output.trim();

    // Strip markdown code fences if Codex added them
    yaml = yaml.replace(/^```ya?ml\n/i, "").replace(/\n```$/m, "").trim();

    if (!yaml || !yaml.includes("steps:")) {
      return { yaml: "", error: "Codex did not produce a valid flow. Try a more specific description." };
    }

    return { yaml };
  } catch (err) {
    const error = err as { message?: string; stdout?: string };
    return {
      yaml: "",
      error: `Codex execution failed: ${error.message}`,
    };
  }
}

function escapeForShell(str: string): string {
  return str
    .replace(/"/g, '\\"')
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n");
}
