/**
 * Acceptance (RED): bake lookup consults manifestEnv after process env.
 * OpenSpec change: manifest-env-bake / mcp-env-bake
 */
import { describe, expect, test } from "vite-plus/test";
import { bakeMap, expectBakeFailure } from "./helpers.ts";

describe("manifest-env-bake — bake lookup precedence", () => {
  test("manifest env fills ${VAR} when process env missing", () => {
    const baked = bakeMap(
      { TOKEN: "${PLUGIN_TOKEN}" },
      { env: {}, manifestEnv: { PLUGIN_TOKEN: "from-yml" } },
    );
    expect(baked.TOKEN).toBe("from-yml");
  });

  test("manifest env fills {bake:NAME} when process env unset", () => {
    const baked = bakeMap(
      { TOKEN: "{bake:PLUGIN_TOKEN}" },
      { env: {}, manifestEnv: { PLUGIN_TOKEN: "from-yml-bake" } },
    );
    expect(baked.TOKEN).toBe("from-yml-bake");
    expect(baked.TOKEN).not.toContain("{bake:");
  });

  test("process env wins over manifest env", () => {
    const baked = bakeMap(
      { TOKEN: "${API_TOKEN}" },
      {
        env: { API_TOKEN: "from-process" },
        manifestEnv: { API_TOKEN: "from-yml" },
      },
    );
    expect(baked.TOKEN).toBe("from-process");
  });

  test("overrides win over process and manifest env", () => {
    const baked = bakeMap(
      { X: "{bake:VAR}" },
      {
        overrides: { VAR: "from-override" },
        env: { VAR: "from-process" },
        manifestEnv: { VAR: "from-yml" },
      },
    );
    expect(baked.X).toBe("from-override");
  });

  test("empty manifest env value does not satisfy bake", () => {
    const message = expectBakeFailure(
      { X: "${EMPTY_VAR}" },
      { env: {}, manifestEnv: { EMPTY_VAR: "" } },
    );
    expect(message).toMatch(/EMPTY_VAR/);
  });

  test("missing in process and manifest fails closed naming the var", () => {
    const secret = "super-secret-do-not-leak";
    const message = expectBakeFailure(
      { A: "${KNOWN}", B: "${MISSING_SECRET}" },
      {
        env: { KNOWN: secret },
        manifestEnv: { KNOWN: "yml-known" },
      },
    );
    expect(message).toMatch(/MISSING_SECRET/);
    expect(message).not.toContain(secret);
  });

  test("headers map also falls back to manifestEnv", () => {
    const baked = bakeMap(
      { Authorization: "Bearer ${PLUGIN_TOKEN}" },
      { env: {}, manifestEnv: { PLUGIN_TOKEN: "hdr-from-yml" } },
    );
    expect(baked.Authorization).toBe("Bearer hdr-from-yml");
  });
});
