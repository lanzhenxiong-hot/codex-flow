import { describe, it, expect, vi } from "vitest";
import { FlowEngine } from "../engine.js";
import type { FlowConfig } from "../types.js";

function makeFlow(steps: FlowConfig["steps"]): FlowConfig {
  return {
    name: "test",
    steps,
  };
}

describe("FlowEngine", () => {
  it("runs a simple flow successfully", async () => {
    const flow = makeFlow([
      { id: "s1", name: "Step 1", type: "shell", command: "echo hello" },
      { id: "s2", name: "Step 2", type: "shell", command: "echo world" },
    ]);

    const engine = new FlowEngine({ logger: () => {} });
    const result = await engine.run(flow);

    expect(result.status).toBe("success");
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe("success");
    expect(result.steps[1].status).toBe("success");
    expect(result.steps[0].output).toContain("hello");
    expect(result.steps[1].output).toContain("world");
  });

  it("stops on error by default", async () => {
    const flow = makeFlow([
      { id: "s1", name: "OK", type: "shell", command: "echo ok" },
      { id: "s2", name: "Fail", type: "shell", command: "exit 1" },
      { id: "s3", name: "Never", type: "shell", command: "echo never" },
    ]);

    const engine = new FlowEngine({ logger: () => {}, stopOnError: true });
    const result = await engine.run(flow);

    expect(result.status).toBe("failed");
    expect(result.steps).toHaveLength(2);
    expect(result.steps[1].status).toBe("failed");
  });

  it("continues on error with stopOnError=false", async () => {
    const flow = makeFlow([
      { id: "s1", name: "OK", type: "shell", command: "echo ok" },
      { id: "s2", name: "Fail", type: "shell", command: "exit 1" },
      { id: "s3", name: "After", type: "shell", command: "echo after" },
    ]);

    const engine = new FlowEngine({ logger: () => {}, stopOnError: false });
    const result = await engine.run(flow);

    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].status).toBe("success");
    expect(result.steps[1].status).toBe("failed");
    expect(result.steps[2].status).toBe("success");
  });

  it("passes variables between steps", async () => {
    const flow = makeFlow([
      {
        id: "produce",
        name: "Produce Value",
        type: "shell",
        command: "echo produced_value",
        output: { saveAs: "my_var" },
      },
      {
        id: "consume",
        name: "Consume Value",
        type: "shell",
        command: "echo {{my_var}}",
      },
    ]);

    const engine = new FlowEngine({ logger: () => {} });
    const result = await engine.run(flow);

    expect(result.status).toBe("success");
    expect(result.steps[1].output).toContain("produced_value");
  });

  it("respects flow-level variables", async () => {
    const flow: FlowConfig = {
      name: "test-vars",
      variables: { greeting: "hi" },
      steps: [
        { id: "s1", name: "Use Var", type: "shell", command: "echo {{greeting}}" },
      ],
    };

    const engine = new FlowEngine({ logger: () => {} });
    const result = await engine.run(flow);

    expect(result.steps[0].output).toContain("hi");
  });

  it("handles wait steps", async () => {
    const flow = makeFlow([
      { id: "w1", name: "Wait", type: "wait", input: { content: "50" } },
    ]);

    const engine = new FlowEngine({ logger: () => {} });
    const result = await engine.run(flow);

    expect(result.status).toBe("success");
    expect(result.steps[0].status).toBe("success");
  });
});
