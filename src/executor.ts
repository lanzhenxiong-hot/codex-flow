import { execSync, exec } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { StepConfig, StepResult, FlowConfig } from "./types.js";

export interface ExecutionContext {
  flow: FlowConfig;
  variables: Record<string, string>;
  results: Map<string, StepResult>;
  logger: (msg: string) => void;
}

export function executeStep(
  step: StepConfig,
  context: ExecutionContext
): Promise<StepResult> {
  const startedAt = new Date();
  const result: StepResult = {
    stepId: step.id,
    stepName: step.name,
    status: "running",
    startedAt,
  };

  context.logger(`  [${step.name}] starting...`);

  return new Promise((resolvePromise) => {
    const timeoutMs = step.timeout ?? 120_000;
    const timeoutHandle = setTimeout(() => {
      result.status = "failed";
      result.error = `Step timed out after ${timeoutMs}ms`;
      result.finishedAt = new Date();
      result.duration = result.finishedAt.getTime() - startedAt.getTime();
      context.logger(`  [${step.name}] ⚠️ timeout`);
      resolvePromise(result);
    }, timeoutMs);

    const onDone = (status: "success" | "failed", output?: string, error?: string) => {
      clearTimeout(timeoutHandle);
      result.status = status;
      result.output = output;
      result.error = error;
      result.finishedAt = new Date();
      result.duration = result.finishedAt.getTime() - startedAt.getTime();

      if (status === "success") {
        context.logger(`  [${step.name}] ✓ done (${formatDuration(result.duration!)})`);
      } else {
        context.logger(`  [${step.name}] ✗ failed: ${error}`);
      }

      if (step.output?.saveAs) {
        context.variables[step.output.saveAs] = output ?? "";
      }

      resolvePromise(result);
    };

    try {
      switch (step.type) {
        case "codex":
          executeCodexStep(step, context, onDone);
          break;
        case "shell":
          executeShellStep(step, context, onDone);
          break;
        case "wait":
          const delay = step.input?.content ? parseInt(step.input.content, 10) : 1000;
          setTimeout(() => onDone("success", `waited ${delay}ms`), delay);
          break;
        case "condition":
          evaluateCondition(step, context, onDone);
          break;
        case "http":
          executeHttpStep(step, context, onDone);
          break;
      }
    } catch (err) {
      onDone("failed", undefined, (err as Error).message);
    }
  });
}

async function executeCodexStep(
  step: StepConfig,
  context: ExecutionContext,
  onDone: (status: "success" | "failed", output?: string, error?: string) => void
) {
  const prompt = renderTemplate(step.prompt ?? "", context);

  if (!prompt) {
    onDone("failed", undefined, "Codex step requires a prompt");
    return;
  }

  let fullPrompt = prompt;
  if (step.input?.file) {
    const filePath = resolve(step.input.file);
    try {
      const { readFileSync } = await import("node:fs");
      const fileContent = readFileSync(filePath, "utf-8");
      fullPrompt += `\n\n--- File: ${step.input.file} ---\n${fileContent}`;
    } catch (err) {
      onDone("failed", undefined, `Cannot read input file: ${(err as Error).message}`);
      return;
    }
  }

  const args = ["exec"];
  if (step.input?.env) {
    for (const [key, value] of Object.entries(step.input.env)) {
      args.push(`--env`, `${key}=${value}`);
    }
  }

  const cmd = `codex ${args.join(" ")} "${fullPrompt.replace(/"/g, '\\"')}"`;

  try {
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: step.timeout ?? 300_000,
      cwd: process.cwd(),
    });
    onDone("success", output.trim());
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    const output = error.stdout ?? error.stderr ?? error.message;
    onDone("failed", output?.trim(), error.message);
  }
}

function executeShellStep(
  step: StepConfig,
  context: ExecutionContext,
  onDone: (status: "success" | "failed", output?: string, error?: string) => void
) {
  const command = step.command
    ? renderTemplate(step.command, context)
    : renderTemplate(step.prompt ?? "", context);

  if (!command) {
    onDone("failed", undefined, "Shell step requires a command or prompt");
    return;
  }

  try {
    const output = execSync(command, {
      encoding: "utf-8",
      timeout: step.timeout ?? 120_000,
      cwd: process.cwd(),
      shell: process.platform === "win32" ? "powershell" : "bash",
    });
    onDone("success", output.trim());
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    const output = error.stdout ?? error.stderr ?? error.message;
    onDone("failed", output?.trim(), error.message);
  }
}

function evaluateCondition(
  step: StepConfig,
  context: ExecutionContext,
  onDone: (status: "success" | "failed", output?: string, error?: string) => void
) {
  const expr = step.prompt ?? step.command ?? "";
  try {
    const sandboxedVars = { ...context.variables };
    for (const [key, value] of Object.entries(context.variables)) {
      sandboxedVars[key] = value;
    }
    const result = new Function(
      ...Object.keys(sandboxedVars),
      `return Boolean(${expr})`
    )(...Object.values(sandboxedVars));

    if (result) {
      onDone("success", "condition met");
    } else {
      onDone("success", "condition not met (skip)");
    }
  } catch (err) {
    onDone("failed", undefined, `Condition evaluation error: ${(err as Error).message}`);
  }
}

async function executeHttpStep(
  step: StepConfig,
  context: ExecutionContext,
  onDone: (status: "success" | "failed", output?: string, error?: string) => void
) {
  const url = renderTemplate(step.command ?? step.prompt ?? "", context);
  if (!url) {
    onDone("failed", undefined, "HTTP step requires a URL");
    return;
  }

  try {
    const method = (step.input?.env?.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (step.input?.env) {
      for (const [k, v] of Object.entries(step.input.env)) {
        if (!k.startsWith("method")) headers[k] = v;
      }
    }

    const response = await fetch(url, {
      method,
      headers,
      body: method !== "GET" && step.input?.content
        ? renderTemplate(step.input.content, context)
        : undefined,
      signal: AbortSignal.timeout(step.timeout ?? 30_000),
    });

    const body = await response.text();
    if (!response.ok) {
      onDone("failed", body, `HTTP ${response.status}: ${response.statusText}`);
    } else {
      onDone("success", body);
    }
  } catch (err) {
    onDone("failed", undefined, (err as Error).message);
  }
}

function renderTemplate(template: string, context: ExecutionContext): string {
  let result = template;
  for (const [key, value] of Object.entries(context.variables)) {
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), value);
  }
  return result;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  return `${min}m ${sec % 60}s`;
}
