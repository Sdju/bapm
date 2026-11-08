/**
 * `lifecycle:` is retained but never executed; install surfaces one warning per
 * declaring package (root manifest + dependency package).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { runInstall } from "../../src/index.ts";
import { createIntegrationRegistry } from "@b-apm/integration-api";

type Project = { cwd: string; cleanup: () => void };

function createProject(rootLifecycle: boolean, depLifecycle: boolean): Project {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-lifecycle-"));
  writeFileSync(
    join(cwd, "bapm.yml"),
    [
      "name: lifecycle-root",
      "version: 0.0.1",
      "active:",
      "  target: cursor",
      ...(rootLifecycle ? ["lifecycle:", "  postinstall: echo nope"] : []),
      "dependencies:",
      "  apm:",
      "    - path: ./leaf",
      "",
    ].join("\n"),
    "utf8",
  );
  mkdirSync(join(cwd, "leaf"), { recursive: true });
  writeFileSync(
    join(cwd, "leaf", "bapm.yml"),
    [
      "name: lifecycle-leaf",
      "version: 0.0.1",
      ...(depLifecycle ? ["lifecycle:", "  test: echo nope"] : []),
      "dependencies:",
      "  apm: []",
      "",
    ].join("\n"),
    "utf8",
  );
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

function lifecycleDiagnostics(result: { diagnostics: unknown[] }): Array<Record<string, unknown>> {
  return result.diagnostics.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      (item as Record<string, unknown>).code === "LIFECYCLE_UNSUPPORTED",
  ) as Array<Record<string, unknown>>;
}

describe("install lifecycle diagnostics", () => {
  let project: Project | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("root and dependency lifecycle each warn once and execute nothing", async () => {
    project = createProject(true, true);
    const registry = createIntegrationRegistry();
    registry.register({
      id: "cursor",
      deployRoots: [".cursor"],
      detect: () => false,
      materialize: async () => ({ targetId: "cursor", deployedFiles: [] }),
    });

    const result = await runInstall({
      cwd: project.cwd,
      integrationRegistry: registry,
      noPolicy: true,
    });

    const warnings = lifecycleDiagnostics(result);
    expect(warnings).toHaveLength(2);
    expect(
      warnings
        .map((warning) => warning.packageName)
        .sort((a, b) => String(a).localeCompare(String(b))),
    ).toEqual(["lifecycle-leaf", "lifecycle-root"]);
    for (const warning of warnings) {
      expect(warning.warn).toBe(true);
      expect(String(warning.message)).toContain("LIFECYCLE_UNSUPPORTED");
      expect(String(warning.message)).toContain(String(warning.packageName));
    }
  });

  test("normal install without lifecycle has no lifecycle diagnostics", async () => {
    project = createProject(false, false);
    const registry = createIntegrationRegistry();
    registry.register({
      id: "cursor",
      deployRoots: [".cursor"],
      detect: () => false,
      materialize: async () => ({ targetId: "cursor", deployedFiles: [] }),
    });

    const result = await runInstall({
      cwd: project.cwd,
      integrationRegistry: registry,
      noPolicy: true,
    });
    expect(result.ok).toBe(true);
    expect(lifecycleDiagnostics(result)).toEqual([]);
  });
});
