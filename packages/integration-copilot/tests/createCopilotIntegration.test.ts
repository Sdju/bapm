import { describe, expect, test } from "vite-plus/test";
import { createCopilotIntegration, createIntegration } from "../src/index.ts";

describe("createCopilotIntegration factory", () => {
  test("aliases createIntegration and exposes translate mcpEnvMode", () => {
    expect(createIntegration).toBe(createCopilotIntegration);
    const target = createCopilotIntegration();
    expect(target.id).toBe("copilot");
    expect(target.deployRoots).toEqual([".github", ".agents"]);
    expect(target.mcpEnvMode).toBe("translate");
    expect(typeof target.detect).toBe("function");
    expect(typeof target.materialize).toBe("function");
    expect(typeof target.configureMcp).toBe("function");
    expect(typeof target.compile).toBe("function");
  });
});
