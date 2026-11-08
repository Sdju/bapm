/**
 * install: dependency hooks go through ExecutableTrust (type `hook`) when a
 * project/user grant surface or org deny is active. Without any grant surface
 * hooks keep the legacy soft behavior (deploy). Root/local hooks stay ungated.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createCursorRegistry,
  createTempProject,
  cursorFlatHookJson,
  getRunInstall,
  writeApmPackage,
  writeText,
  type TempProject,
} from "./commands-hooks-helpers.ts";

const SCRIPT = "#!/bin/sh\necho notify\n";

type Diagnostic = Record<string, unknown>;

function diagnosticsOf(result: unknown): Diagnostic[] {
  if (!result || typeof result !== "object") return [];
  const diagnostics = (result as { diagnostics?: unknown }).diagnostics;
  if (!Array.isArray(diagnostics)) return [];
  return diagnostics.filter(
    (item): item is Diagnostic => Boolean(item) && typeof item === "object",
  );
}

function hookWithholdDiagnostics(result: unknown): Diagnostic[] {
  return diagnosticsOf(result).filter((item) => item.code === "HOOK_TRUST_WITHHELD");
}

function readCursorHooks(cwd: string): {
  hooks?: Record<string, Array<{ command?: string }>>;
} {
  const path = join(cwd, ".cursor", "hooks.json");
  expect(existsSync(path), `.cursor/hooks.json must exist at ${path}`).toBe(true);
  return JSON.parse(readFileSync(path, "utf8")) as {
    hooks?: Record<string, Array<{ command?: string }>>;
  };
}

function dependencyHookDeployed(cwd: string, hookName: string): boolean {
  if (!existsSync(join(cwd, ".cursor", "hooks.json"))) return false;
  const doc = readCursorHooks(cwd);
  const commands = Object.values(doc.hooks ?? {})
    .flat()
    .map((entry) => entry.command)
    .filter((command): command is string => typeof command === "string");
  // The Cursor integration copies the package hook content under .cursor/hooks/
  // and registers a command pointing at that deployed file.
  return commands.some((command) => command.includes(hookName) || command.includes(".cursor/"));
}

function writeRootProject(cwd: string, body: string): void {
  writeFileSync(join(cwd, "bapm.yml"), body, "utf8");
}

function setupDependencyHook(cwd: string, hookName = "session-start"): void {
  const dep = join(cwd, "hook-dep");
  writeApmPackage(dep, "hook-dep", {
    hooks: { [hookName]: cursorFlatHookJson("./scripts/notify.sh") },
  });
  writeText(join(dep, "scripts", "notify.sh"), SCRIPT);
}

function setupRootLocalHook(cwd: string, hookName = "root-session-start"): void {
  writeText(
    join(cwd, ".apm", "hooks", `${hookName}.json`),
    cursorFlatHookJson("./scripts/root-notify.sh"),
  );
  writeText(join(cwd, "scripts", "root-notify.sh"), SCRIPT);
}

async function install(cwd: string): Promise<unknown> {
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  const registry = createCursorRegistry();
  return getRunInstall()({
    cwd,
    frozen: false,
    integrationRegistry: registry,
    registry,
    configDir: join(cwd, ".bapm-user"),
  });
}

describe("install hooks trust gate", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("dependency hook deploys with no grant surface (legacy soft)", async () => {
    project = createTempProject();
    setupDependencyHook(project.cwd);
    writeRootProject(
      project.cwd,
      `name: legacy-hooks\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./hook-dep\n`,
    );

    const result = await install(project.cwd);

    expect(hookWithholdDiagnostics(result)).toEqual([]);
    expect(dependencyHookDeployed(project.cwd, "session-start")).toBe(true);
  });

  test("unapproved dependency hook is withheld when an allow surface exists (warn diagnostic)", async () => {
    project = createTempProject();
    setupDependencyHook(project.cwd);
    writeRootProject(
      project.cwd,
      `name: surface-hooks\nversion: 0.0.1\ntarget: cursor\nexecutables:\n  allow:\n    acme/other:\n      mcp: true\ndependencies:\n  apm:\n    - path: ./hook-dep\n`,
    );

    const result = await install(project.cwd);

    const withheld = hookWithholdDiagnostics(result);
    expect(withheld).toHaveLength(1);
    expect(withheld[0]).toMatchObject({
      code: "HOOK_TRUST_WITHHELD",
      warn: true,
      packageName: "hook-dep",
    });
    expect(String(withheld[0]?.message)).toMatch(/hook-dep/);
    expect(String(withheld[0]?.message)).toMatch(/withhold|unapproved|allow/i);
    expect(dependencyHookDeployed(project.cwd, "session-start")).toBe(false);
    expect(existsSync(join(project.cwd, ".cursor", "hooks.json"))).toBe(false);
  });

  test("project allow for hook-dep.hook deploys the hook", async () => {
    project = createTempProject();
    setupDependencyHook(project.cwd);
    writeRootProject(
      project.cwd,
      `name: hook-allowed\nversion: 0.0.1\ntarget: cursor\nexecutables:\n  allow:\n    hook-dep:\n      hook: true\ndependencies:\n  apm:\n    - path: ./hook-dep\n`,
    );

    const result = await install(project.cwd);

    expect(hookWithholdDiagnostics(result)).toEqual([]);
    expect(dependencyHookDeployed(project.cwd, "session-start")).toBe(true);
  });

  test("org executables.deny withholds hooks even without a project surface", async () => {
    project = createTempProject();
    setupDependencyHook(project.cwd);
    writeRootProject(
      project.cwd,
      `name: org-deny-hooks\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./hook-dep\n`,
    );
    writeText(
      join(project.cwd, "bapm-policy.yml"),
      `name: org-deny-hooks\nenforcement: warn\nexecutables:\n  deny:\n    - hook-dep\n`,
    );

    const result = await install(project.cwd);

    const withheld = hookWithholdDiagnostics(result);
    expect(withheld).toHaveLength(1);
    expect(String(withheld[0]?.message)).toMatch(/org|deny|hook-dep/i);
    expect(dependencyHookDeployed(project.cwd, "session-start")).toBe(false);
  });

  test("root direct hook still deploys under a grant surface", async () => {
    project = createTempProject();
    setupRootLocalHook(project.cwd, "root-session-start");
    writeRootProject(
      project.cwd,
      `name: root-hook\nversion: 0.0.1\ntarget: cursor\nexecutables:\n  allow:\n    acme/other:\n      mcp: true\n`,
    );

    const result = await install(project.cwd);

    expect(hookWithholdDiagnostics(result)).toEqual([]);
    const doc = readCursorHooks(project.cwd);
    const commands = Object.values(doc.hooks ?? {})
      .flat()
      .map((entry) => entry.command)
      .filter((command): command is string => typeof command === "string");
    expect(commands.length).toBeGreaterThan(0);
  });
});
