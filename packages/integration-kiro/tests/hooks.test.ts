/**
 * Hooks → per-file .kiro/hooks v1 JSON (not legacy when/then).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  ensureKiroDir,
  loadKiroIntegration,
  readJson,
  writeJson,
} from "./helpers.ts";

describe("kiro hooks", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("hook expands to v1 per-file JSON under .kiro/hooks", async () => {
    const project = createTempProject("bapm-kiro-hooks-v1-");
    cleanup = project.cleanup;
    ensureKiroDir(project.cwd);

    mkdirSync(join(project.cwd, "pkg", "hooks"), { recursive: true });
    writeFileSync(join(project.cwd, "pkg", "hooks", "check.py"), "# check\n", "utf8");
    const hookSrc = join(project.cwd, "pkg", "hooks", "hooks.json");
    writeJson(hookSrc, {
      hooks: {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: "python ${PLUGIN_ROOT}/hooks/check.py",
              },
            ],
          },
        ],
      },
    });

    const target = loadKiroIntegration();
    await target.materialize(
      [
        {
          name: "hooks",
          type: "hook",
          source: "dependency:hookify",
          packageName: "hookify",
          path: hookSrc,
        },
      ],
      { cwd: project.cwd, targetId: "kiro", deployRoots: target.deployRoots },
    );

    const hooksDir = join(project.cwd, ".kiro", "hooks");
    expect(existsSync(hooksDir)).toBe(true);
    const jsonFiles = readdirSync(hooksDir).filter((f) => f.endsWith(".json"));
    expect(jsonFiles.length).toBeGreaterThan(0);

    const hookFile = jsonFiles
      .map((f) => join(hooksDir, f))
      .find((p) => {
        const doc = readJson(p);
        return doc.version === "v1";
      });
    expect(hookFile).toBeTruthy();
    const doc = readJson(hookFile!);
    expect(doc.version).toBe("v1");
    expect(Array.isArray(doc.hooks)).toBe(true);
    const first = (doc.hooks as Array<Record<string, unknown>>)[0];
    expect(first).toBeTruthy();
    expect(first.trigger).toBe("PreToolUse");
    const action = first.action as Record<string, unknown>;
    expect(action.type).toBe("command");
    expect(String(action.command)).toMatch(/check\.py/);
    expect(JSON.stringify(doc)).not.toMatch(/"when"\s*:/);
    expect(JSON.stringify(doc)).not.toMatch(/"then"\s*:/);
  });
});
