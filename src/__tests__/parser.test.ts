import { describe, it, expect } from "vitest";
import { parseFlowYAML } from "../parser.js";

describe("parseFlowYAML", () => {
  it("parses a valid flow", () => {
    const yaml = `
name: test-flow
description: "A test"
variables:
  key: "value"
steps:
  - id: step1
    name: "First Step"
    type: shell
    command: "echo hello"
  - id: step2
    name: "Second Step"
    type: codex
    prompt: "Do something"
`;
    const { flow } = parseFlowYAML(yaml);
    expect(flow.name).toBe("test-flow");
    expect(flow.steps).toHaveLength(2);
    expect(flow.steps[0].type).toBe("shell");
    expect(flow.steps[1].type).toBe("codex");
  });

  it("rejects invalid flow (no steps)", () => {
    expect(() => parseFlowYAML("name: empty\n")).toThrow();
  });

  it("rejects duplicate step ids", () => {
    const yaml = `
name: dup
steps:
  - id: same
    name: "A"
    type: shell
    command: "echo a"
  - id: same
    name: "B"
    type: shell
    command: "echo b"
`;
    expect(() => parseFlowYAML(yaml)).toThrow("Duplicate step id");
  });

  it("supports retry config", () => {
    const yaml = `
name: retry-test
steps:
  - id: r1
    name: "Retry Step"
    type: shell
    command: "echo retry"
    retry:
      maxAttempts: 3
      backoff: exponential
`;
    const { flow } = parseFlowYAML(yaml);
    expect(flow.steps[0].retry).toEqual({
      maxAttempts: 3,
      delayMs: 1000,
      backoff: "exponential",
    });
  });
});
