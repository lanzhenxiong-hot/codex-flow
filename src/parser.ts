import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import type { FlowConfig, StepConfig } from "./types.js";

const RetrySchema = z.object({
  maxAttempts: z.number().int().min(1).max(10),
  delayMs: z.number().optional().default(1000),
  backoff: z.enum(["fixed", "exponential"]).optional().default("fixed"),
});

const StepSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["codex", "shell", "http", "wait", "condition"]),
  prompt: z.string().optional(),
  command: z.string().optional(),
  input: z
    .object({
      file: z.string().optional(),
      content: z.string().optional(),
      template: z.string().optional(),
      env: z.record(z.string()).optional(),
    })
    .optional(),
  output: z
    .object({
      saveAs: z.string().optional(),
      file: z.string().optional(),
      format: z.enum(["text", "json", "code"]).optional().default("text"),
    })
    .optional(),
  condition: z
    .object({
      when: z.string(),
      variables: z.record(z.string()).optional(),
    })
    .optional(),
  retry: RetrySchema.optional(),
  timeout: z.number().optional(),
  parallel: z.boolean().optional().default(false),
});

const FlowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional(),
  variables: z.record(z.string()).optional(),
  steps: z.array(StepSchema).min(1),
  include: z.array(z.string()).optional(),
});

export interface ParseResult {
  flow: FlowConfig;
  warnings: string[];
}

export function parseFlowFile(filePath: string): ParseResult {
  const absolutePath = resolve(filePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Flow file not found: ${absolutePath}`);
  }

  const raw = readFileSync(absolutePath, "utf-8");
  const warnings: string[] = [];

  const data = YAML.parse(raw);
  const parsed = FlowSchema.safeParse(data);

  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid flow config:\n${errors}`);
  }

  const flow = parsed.data as unknown as FlowConfig;

  const ids = new Set<string>();
  for (const step of flow.steps) {
    if (ids.has(step.id)) {
      throw new Error(`Duplicate step id: ${step.id}`);
    }
    ids.add(step.id);
  }

  if (flow.include?.length) {
    resolveIncludes(flow, absolutePath, warnings);
  }

  return { flow, warnings };
}

export function parseFlowYAML(content: string): ParseResult {
  const warnings: string[] = [];
  const data = YAML.parse(content);
  const parsed = FlowSchema.safeParse(data);

  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid flow config:\n${errors}`);
  }

  const flow = parsed.data as unknown as FlowConfig;

  const ids = new Set<string>();
  for (const step of flow.steps) {
    if (ids.has(step.id)) {
      throw new Error(`Duplicate step id: ${step.id}`);
    }
    ids.add(step.id);
  }

  return { flow, warnings };
}

function resolveIncludes(flow: FlowConfig, baseDir: string, warnings: string[]): void {
  for (const includePath of flow.include!) {
    const resolved = resolve(dirname(baseDir), includePath);
    if (!existsSync(resolved)) {
      warnings.push(`Include not found: ${includePath} (resolved: ${resolved})`);
      continue;
    }

    const raw = readFileSync(resolved, "utf-8");
    const data = YAML.parse(raw);
    const parsed = FlowSchema.safeParse(data);

    if (!parsed.success) {
      warnings.push(`Invalid included flow: ${includePath}`);
      continue;
    }

    const included = parsed.data as unknown as FlowConfig;

    // Merge variables
    if (included.variables) {
      flow.variables = { ...included.variables, ...(flow.variables ?? {}) };
    }

    // Prefix step IDs to avoid collisions
    const prefix = includePath
      .replace(/\.flow\.yaml$/, "")
      .replace(/\.yaml$/, "")
      .replace(/[^a-zA-Z0-9]/g, "-");

    for (const step of included.steps) {
      const newId = `${prefix}-${step.id}`;
      flow.steps.push({
        ...step,
        id: newId,
        name: `[${prefix}] ${step.name}`,
      });
    }

    // Recursively resolve nested includes
    if (included.include?.length) {
      const tempFlow: FlowConfig = { ...included, steps: [] };
      resolveIncludes(tempFlow, resolved, warnings);
      for (const step of tempFlow.steps) {
        flow.steps.push(step);
      }
    }
  }

  flow.include = undefined;
}
