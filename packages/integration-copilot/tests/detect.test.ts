import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCopilotIntegration } from "../src/index.ts";

describe("createCopilotIntegration detect", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) cleanups.pop()?.();
  });

  function temp(): string {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-copilot-unit-detect-"));
    cleanups.push(() => rmSync(cwd, { recursive: true, force: true }));
    return cwd;
  }

  test("whitelist matrix and empty / lone .agents", async () => {
    const target = createCopilotIntegration();

    const empty = temp();
    expect(await target.detect({ cwd: empty })).toBe(false);
    expect(existsSync(join(empty, ".github"))).toBe(false);

    const agentsOnly = temp();
    mkdirSync(join(agentsOnly, ".agents", "skills"), { recursive: true });
    expect(await target.detect({ cwd: agentsOnly })).toBe(false);

    const withFile = temp();
    mkdirSync(join(withFile, ".github"), { recursive: true });
    writeFileSync(join(withFile, ".github", "copilot-instructions.md"), "# x\n", "utf8");
    expect(await target.detect({ cwd: withFile })).toBe(true);

    for (const dir of ["instructions", "agents", "prompts", "hooks"]) {
      const cwd = temp();
      mkdirSync(join(cwd, ".github", dir), { recursive: true });
      expect(await target.detect({ cwd })).toBe(true);
    }
  });
});
