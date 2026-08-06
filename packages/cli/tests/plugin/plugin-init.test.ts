/**
 * cli-plugin-init — non-interactive scaffold, names, overwrite, flags, next-steps.
 */
import { loadManifest } from "@bapm/core";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  assertThinScaffold,
  createTempProject,
  cwdBasename,
  expectKnownCommand,
  existsSync,
  join,
  readText,
  runInProject,
  stderrText,
  stdoutText,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("mp-plugin-init CLI plugin init", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("plugin init --yes writes plugin.json + bapm.yml only (thin scaffold)", async () => {
    project = createTempProject({ basename: "my-plugin" });
    expect(cwdBasename(project.cwd)).toMatch(/^[a-z][a-z0-9-]{0,63}$/);

    const { result, combined } = await runInProject(project.cwd, ["plugin", "init", "--yes"]);
    expectKnownCommand(combined, "plugin");
    expect(result).toBe(0);
    assertThinScaffold(project.cwd);
  });

  test("plugin init -y is accepted alias for --yes", async () => {
    project = createTempProject({ basename: "alias-plugin" });
    const { result, combined } = await runInProject(project.cwd, ["plugin", "init", "-y"]);
    expectKnownCommand(combined, "plugin");
    expect(result).toBe(0);
    assertThinScaffold(project.cwd);
  });

  test("plugin.json fields match APM-shaped defaults under --yes", async () => {
    project = createTempProject({ basename: "field-plugin" });
    const { result, combined } = await runInProject(project.cwd, ["plugin", "init", "--yes"]);
    expectKnownCommand(combined, "plugin");
    expect(result).toBe(0);

    const raw = readText(project.cwd, "plugin.json");
    expect(raw.endsWith("\n")).toBe(true);
    const doc = JSON.parse(raw) as Record<string, unknown>;
    expect(doc.name).toBe("field-plugin");
    expect(doc.version).toBe("0.1.0");
    expect(typeof doc.description).toBe("string");
    expect(doc.author).toEqual(expect.objectContaining({ name: expect.any(String) }));
    expect(doc.license).toBe("MIT");
  });

  test("bapm.yml plugin-mode includes deps + devDependencies.apm at 0.1.0", async () => {
    project = createTempProject({ basename: "yml-plugin" });
    const { result, combined } = await runInProject(project.cwd, ["plugin", "init", "--yes"]);
    expectKnownCommand(combined, "plugin");
    expect(result).toBe(0);

    const { document: doc } = loadManifest({ cwd: project.cwd });
    expect(doc.name).toBe("yml-plugin");
    expect(doc.version).toBe("0.1.0");
    const deps = doc.dependencies as Record<string, unknown>;
    expect(deps).toBeTruthy();
    expect(Array.isArray(deps.apm)).toBe(true);
    expect(Array.isArray(deps.mcp)).toBe(true);
    const record = doc as Record<string, unknown>;
    const devDeps = record.devDependencies as Record<string, unknown>;
    expect(devDeps).toBeTruthy();
    expect(Array.isArray(devDeps.apm)).toBe(true);
  });

  test("PROJECT_NAME creates subdirectory scaffold with matching plugin.json name", async () => {
    project = createTempProject({ basename: "parent-dir" });
    const { result, combined } = await runInProject(project.cwd, [
      "plugin",
      "init",
      "--yes",
      "my-plugin",
    ]);
    expectKnownCommand(combined, "plugin");
    expect(result).toBe(0);

    const sub = join(project.cwd, "my-plugin");
    assertThinScaffold(sub);
    const doc = JSON.parse(readText(sub, "plugin.json")) as { name: string };
    expect(doc.name).toBe("my-plugin");
  });

  test("PROJECT_NAME with path separator fails and writes nothing", async () => {
    project = createTempProject({ basename: "safe-parent" });
    const { result, combined } = await runInProject(project.cwd, [
      "plugin",
      "init",
      "--yes",
      "foo/bar",
    ]);
    expectKnownCommand(combined, "plugin");
    expect(result).not.toBe(0);
    expect(existsSync(join(project.cwd, "foo"))).toBe(false);
    expect(existsSync(join(project.cwd, "foo/bar"))).toBe(false);
    expect(existsSync(join(project.cwd, "plugin.json"))).toBe(false);
  });

  test("uppercase plugin name rejected with clear error", async () => {
    project = createTempProject({ basename: "reject-parent" });
    const { result, stderr, combined } = await runInProject(project.cwd, [
      "plugin",
      "init",
      "--yes",
      "MyPlugin",
    ]);
    expectKnownCommand(combined, "plugin");
    expect(result).not.toBe(0);
    expect(stderrText(stderr)).toMatch(/invalid plugin name/i);
    expect(existsSync(join(project.cwd, "MyPlugin"))).toBe(false);
  });

  test("leading digit plugin name rejected", async () => {
    project = createTempProject({ basename: "reject-digit" });
    const { result, stderr, combined } = await runInProject(project.cwd, [
      "plugin",
      "init",
      "--yes",
      "1bad",
    ]);
    expectKnownCommand(combined, "plugin");
    expect(result).not.toBe(0);
    expect(stderrText(stderr)).toMatch(/invalid plugin name/i);
  });

  test("existing bapm.yml without --yes refuses and does not overwrite", async () => {
    project = createTempProject({ basename: "keep-plugin" });
    const original = 'name: keep-me\nversion: "9.9.9"\n';
    writeText(project.cwd, "bapm.yml", original);

    const { result, combined } = await runInProject(project.cwd, ["plugin", "init"]);
    expectKnownCommand(combined, "plugin");
    expect(result).not.toBe(0);
    expect(readText(project.cwd, "bapm.yml")).toBe(original);
    expect(existsSync(join(project.cwd, "plugin.json"))).toBe(false);
  });

  test("existing bapm.yml with --yes overwrites plugin scaffold", async () => {
    project = createTempProject({ basename: "overwrite-plugin" });
    writeText(project.cwd, "bapm.yml", 'name: old-name\nversion: "9.9.9"\n');

    const { result, combined } = await runInProject(project.cwd, ["plugin", "init", "--yes"]);
    expectKnownCommand(combined, "plugin");
    expect(result).toBe(0);
    assertThinScaffold(project.cwd);

    const { document: yml } = loadManifest({ cwd: project.cwd });
    expect(yml.name).toBe("overwrite-plugin");
    expect(yml.version).toBe("0.1.0");
    const plugin = JSON.parse(readText(project.cwd, "plugin.json")) as {
      name: string;
      version: string;
    };
    expect(plugin.name).toBe("overwrite-plugin");
    expect(plugin.version).toBe("0.1.0");
  });

  test("--target cursor is recorded in bapm.yml", async () => {
    project = createTempProject({ basename: "target-plugin" });
    const { result, combined } = await runInProject(project.cwd, [
      "plugin",
      "init",
      "--yes",
      "--target",
      "cursor",
    ]);
    expectKnownCommand(combined, "plugin");
    expect(result).toBe(0);

    const { document: doc } = loadManifest({ cwd: project.cwd });
    const target = doc.target;
    const targets = doc.targets;
    if (target !== undefined) {
      expect(target).toBe("cursor");
    } else {
      expect(Array.isArray(targets)).toBe(true);
      expect(targets).toContain("cursor");
    }
  });

  test("--verbose / -v accepted with successful scaffold", async () => {
    project = createTempProject({ basename: "verbose-plugin" });
    for (const flag of ["--verbose", "-v"] as const) {
      project.cleanup();
      project = createTempProject({ basename: "verbose-plugin" });
      const { result, combined } = await runInProject(project.cwd, [
        "plugin",
        "init",
        "--yes",
        flag,
      ]);
      expectKnownCommand(combined, "plugin");
      expect(result).toBe(0);
      assertThinScaffold(project.cwd);
    }
  });

  test("success stdout mentions bapm pack next-step hint", async () => {
    project = createTempProject({ basename: "hint-plugin" });
    const { result, stdout, combined } = await runInProject(project.cwd, [
      "plugin",
      "init",
      "--yes",
    ]);
    expectKnownCommand(combined, "plugin");
    expect(result).toBe(0);
    expect(stdoutText(stdout)).toMatch(/bapm\s+pack/i);
  });

  test("consumer bapm init still refuses overwrite when bapm.yml exists", async () => {
    project = createTempProject({ basename: "consumer-keep" });
    const original = 'name: keep-consumer\nversion: "8.8.8"\n';
    writeText(project.cwd, "bapm.yml", original);

    const { result, combined } = await runInProject(project.cwd, ["init", "-y", "other"]);
    expectKnownCommand(combined, "init");
    expect(result).not.toBe(0);
    expect(readText(project.cwd, "bapm.yml")).toBe(original);
  });
});
