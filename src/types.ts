/**
 * codex-flow type definitions
 */

export interface FlowConfig {
  name: string;
  description?: string;
  version?: string;
  variables?: Record<string, string>;
  steps: StepConfig[];
  include?: string[];
}

export interface StepConfig {
  id: string;
  name: string;
  description?: string;
  type: StepType;
  prompt?: string;
  command?: string;
  input?: StepInput;
  output?: StepOutput;
  condition?: Condition;
  retry?: RetryConfig;
  timeout?: number;
  parallel?: boolean;
}

export type StepType =
  | "codex"
  | "shell"
  | "http"
  | "wait"
  | "condition";

export interface StepInput {
  file?: string;
  content?: string;
  template?: string;
  env?: Record<string, string>;
}

export interface StepOutput {
  saveAs?: string;
  file?: string;
  format?: "text" | "json" | "code";
}

export interface Condition {
  when: string;
  variables?: Record<string, string>;
}

export interface RetryConfig {
  maxAttempts: number;
  delayMs?: number;
  backoff?: "fixed" | "exponential";
}

export interface FlowResult {
  flowName: string;
  startedAt: Date;
  finishedAt?: Date;
  status: "success" | "failed" | "cancelled";
  steps: StepResult[];
  logs: string[];
}

export interface StepResult {
  stepId: string;
  stepName: string;
  status: "success" | "failed" | "skipped" | "running";
  startedAt?: Date;
  finishedAt?: Date;
  output?: string;
  error?: string;
  duration?: number;
}

export interface CodexOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}
