/**
 * CLI user-scope compile (`bapm compile --global`).
 *
 * Global manifest/lock resolve from ~/.bapm (BAPM_HOME honored); supported
 * Cursor/Claude/Codex root files deploy under $HOME while project files stay
 * untouched. Unsupported hosts fail closed; clean/watch use global paths.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyBuildId } from "@b-apm/integration-api";
import { runCompileCli } from "../../src/modules/Compile/services/runCompile.ts";
import {
  createTempProject,
  linkPackageDir,
  runInProject,
  withCapturedIo,
  type TempProject,
} from "../install/helpers.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGES_ROOT = join(HERE, "../../..");
const COMPILE_HOSTS = ["cursor", "claude", "codex"] as const;
const deps = { name: "bapm", manifestFile: "bapm.yml", lockFile: "bapm.lock.yaml" };

type GlobalFixture = {
  project: TempProject;
  home: string;
  globalRoot: string;
  cleanup: () => void;
};

function createGlobalFixture(): GlobalFixture {
  const project = createTempProject("bapm-global-compile-project-");
  const home = mkdtempSync(join(tmpdir(), "bapm-global-compile-home-"));
  const globalRoot = join(home, ".bapm");
  mkdirSync(join(globalRoot, "node_modules", "@b-apm"), { recursive: true });
  for (const id of COMPILE_HOSTS) {
    linkPackageDir(globalRoot, join(PACKAGES_ROOT, `integration-${id}`));
  }
  return {
    project,
    home,
    globalRoot,
    cleanup: () => {
      project.cleanup();
      rmSync(home, { recursive: true, force: true });
    },
  };
}

function writeGlobalManifest(fx: GlobalFixture): void {
  const targets = COMPILE_HOSTS.map((id) => `  ${id}: "@b-apm/integration-${id}"`).join("\n");
  writeFileSync(
    join(fx.globalRoot, "bapm.yml"),
    ["name: global", "version: 0.1.0", "targets:", targets, "dependencies:", "  apm: []", ""].join(
      "\n",
    ),
    "utf8",
  );
  mkdirSync(join(fx.globalRoot, ".apm", "instructions"), { recursive: true });
  writeFileSync(
    join(fx.globalRoot, ".apm", "instructions", "style.md"),
    "# Style\nPrefer concise answers.\n",
    "utf8",
  );
}

function globalEnv(fx: GlobalFixture): Record<string, string> {
  return {
    HOME: fx.home,
    USERPROFILE: fx.home,
    XDG_CONFIG_HOME: join(fx.home, ".config"),
    BAPM_HOME: fx.globalRoot,
  };
}

function runGlobal(fx: GlobalFixture, argv: string[]): ReturnType<typeof runInProject> {
  return runInProject(fx.project.cwd, argv, globalEnv(fx));
}

async function withEnv<T>(env: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    saved[key] = process.env[key];
    process.env[key] = env[key];
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("CLI compile --global", () => {
  let fixture: GlobalFixture | undefined;

  afterEach(() => {
    fixture?.cleanup();
    fixture = undefined;
  });

  test("Cursor/Claude/Codex write home root files; project and global root stay untouched", async () => {
    fixture = createGlobalFixture();
    writeGlobalManifest(fixture);

    const { result, combined } = await runGlobal(fixture, ["compile", "--global", "--all"]);

    expect(result, combined).toBe(0);
    expect(combined).toMatch(/Wrote \.cursor\/AGENTS\.md/);
    expect(combined).toMatch(/Wrote \.claude\/CLAUDE\.md/);
    expect(combined).toMatch(/Wrote \.codex\/AGENTS\.md/);
    for (const rel of [".cursor/AGENTS.md", ".claude/CLAUDE.md", ".codex/AGENTS.md"]) {
      expect(existsSync(join(fixture.home, rel)), rel).toBe(true);
      expect(readFileSync(join(fixture.home, rel), "utf8")).toMatch(/concise/i);
    }

    for (const dir of [".cursor", ".claude", ".codex", ".agents"]) {
      expect(existsSync(join(fixture.globalRoot, dir))).toBe(false);
      expect(existsSync(join(fixture.project.cwd, dir))).toBe(false);
    }
    expect(existsSync(join(fixture.project.cwd, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(fixture.project.cwd, "bapm.yml"))).toBe(false);
  });

  test("unsupported global compile host fails with a clear diagnostic", async () => {
    fixture = createGlobalFixture();
    const modulePath = join(fixture.globalRoot, "other-integration.mjs");
    writeFileSync(
      modulePath,
      [
        "export function createIntegration() {",
        '  return { id: "x-acme-other", deployRoots: [".other"], detect: () => false,',
        '    materialize: async () => ({ targetId: "x-acme-other", deployedFiles: [] }),',
        '    compile: async () => ({ path: "OTHER.md", content: "", wrote: false }) };',
        "}",
        "",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      join(fixture.globalRoot, "bapm.yml"),
      [
        "name: global",
        "version: 0.1.0",
        "targets:",
        '  x-acme-other: "./other-integration.mjs"',
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
      "utf8",
    );

    const { result, combined } = await runGlobal(fixture, [
      "compile",
      "--global",
      "--target",
      "x-acme-other",
    ]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/Global compile is not supported.*x-acme-other/i);
    expect(existsSync(join(fixture.home, ".other"))).toBe(false);
    expect(existsSync(join(fixture.globalRoot, ".other"))).toBe(false);
  });

  test("global clean removes stale home outputs and leaves unselected roots alone", async () => {
    fixture = createGlobalFixture();
    writeGlobalManifest(fixture);

    expect((await runGlobal(fixture, ["compile", "--global", "--target", "cursor"])).result).toBe(
      0,
    );
    mkdirSync(join(fixture.home, ".cursor", "old"), { recursive: true });
    writeFileSync(
      join(fixture.home, ".cursor", "old", "AGENTS.md"),
      applyBuildId("# stale\n\nOld generated output.\n"),
      "utf8",
    );
    writeFileSync(
      join(fixture.home, "AGENTS.md"),
      applyBuildId("# outside\n\nNot a cursor root file.\n"),
      "utf8",
    );

    const { result, combined } = await runGlobal(fixture, [
      "compile",
      "--global",
      "--target",
      "cursor",
      "--clean",
    ]);

    expect(result, combined).toBe(0);
    expect(combined).toMatch(/compile --clean: removed \.cursor\/old\/AGENTS\.md/);
    expect(existsSync(join(fixture.home, ".cursor", "old", "AGENTS.md"))).toBe(false);
    expect(existsSync(join(fixture.home, ".cursor", "AGENTS.md"))).toBe(true);
    expect(existsSync(join(fixture.home, "AGENTS.md"))).toBe(true);
  });

  test("global watch once compiles home outputs from the global root", async () => {
    fixture = createGlobalFixture();
    writeGlobalManifest(fixture);

    const { result, stdout } = await withEnv(globalEnv(fixture), () =>
      withCapturedIo(() =>
        runCompileCli(deps, {
          args: ["--global", "--target", "cursor", "--watch"],
          watch: {
            once: true,
            watchFactory: () => {
              throw new Error("watcher must not be created in once mode");
            },
          },
        }),
      ),
    );

    expect(result.exitCode).toBe(0);
    expect(stdout.join("\n")).toMatch(/Wrote \.cursor\/AGENTS\.md/);
    expect(existsSync(join(fixture.home, ".cursor", "AGENTS.md"))).toBe(true);
    expect(existsSync(join(fixture.globalRoot, ".cursor"))).toBe(false);
  });
});
