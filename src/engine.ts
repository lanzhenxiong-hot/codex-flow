import type { FlowConfig, FlowResult, StepConfig, StepResult } from "./types.js";
import { executeStep, type ExecutionContext } from "./executor.js";

export interface EngineOptions {
  logger?: (msg: string) => void;
  stopOnError?: boolean;
}

export class FlowEngine {
  private options: EngineOptions;

  constructor(options: EngineOptions = {}) {
    this.options = {
      logger: options.logger ?? console.log,
      stopOnError: options.stopOnError ?? true,
    };
  }

  async run(flow: FlowConfig): Promise<FlowResult> {
    const startedAt = new Date();
    const result: FlowResult = {
      flowName: flow.name,
      startedAt,
      status: "success",
      steps: [],
      logs: [],
    };

    const context: ExecutionContext = {
      flow,
      variables: { ...(flow.variables ?? {}) },
      results: new Map(),
      logger: (msg: string) => {
        this.options.logger!(msg);
        result.logs.push(msg);
      },
    };

    this.options.logger(`\n🚀 Flow: ${flow.name}${flow.description ? ` — ${flow.description}` : ""}`);
    this.options.logger(`   Steps: ${flow.steps.length}\n`);

    let i = 0;
    while (i < flow.steps.length) {
      const batch = this.collectParallelGroup(flow.steps, i);

      if (batch.length > 1) {
        this.options.logger(`  ⚡ Parallel group: ${batch.map((s) => s.name).join(", ")}`);
        const results = await Promise.all(
          batch.map((step) => executeStep(step, context))
        );
        for (const stepResult of results) {
          result.steps.push(stepResult);
          context.results.set(stepResult.stepId, stepResult);
          if (stepResult.status === "failed" && this.options.stopOnError) {
            result.status = "failed";
            this.options.logger(`\n❌ Flow failed at step: ${stepResult.stepName}`);
            result.finishedAt = new Date();
            return result;
          }
        }
      } else {
        const step = batch[0];
        const stepResult = await executeStep(step, context);
        result.steps.push(stepResult);
        context.results.set(stepResult.stepId, stepResult);

        if (stepResult.status === "failed" && this.options.stopOnError) {
          result.status = "failed";
          this.options.logger(`\n❌ Flow failed at step: ${stepResult.stepName}`);
          result.finishedAt = new Date();
          return result;
        }
      }

      i += batch.length;
    }

    result.finishedAt = new Date();
    const duration = (result.finishedAt.getTime() - startedAt.getTime()) / 1000;
    this.options.logger(`\n${result.status === "success" ? "✅" : "❌"} Flow completed in ${duration.toFixed(1)}s`);
    return result;
  }

  private collectParallelGroup(steps: StepConfig[], startIdx: number): StepConfig[] {
    const first = steps[startIdx];
    if (!first?.parallel) return [first];

    const group: StepConfig[] = [first];
    let j = startIdx + 1;
    while (j < steps.length && steps[j].parallel) {
      group.push(steps[j]);
      j++;
    }
    return group;
  }
}
