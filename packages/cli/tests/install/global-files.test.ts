/**
 * User-scope (`bapm install --global`) file-primitive deployment.
 *
 * - Manifest/lock resolve from ~/.bapm (BAPM_HOME honored)
 * - Cursor/Claude/Codex/agent-skills deploy into the user's home harness dirs
 * - No project-shaped files are written under the global manifest root
 * - Deployed hashes are home-relative and replay under --frozen
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createTempProject,
  linkPackageDir,
  runInProject,
  type TempProject,
} from "../mcp/helpers.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGES_ROOT = join(HERE, "../../..");
const FILE_HOSTS = ["cursor", "claude", "codex", "agent-skills"] as const;

type GlobalFixture = {
  project: TempProject;
  home: string;
  globalRoot: string;
  cleanup: () => void;
};

function createGlobalFixture(): GlobalFixture {
  const project = createTempProject("bapm-global-files-project-");
  const home = mkdtempSync(join(tmpdir(), "bapm-global-files-home-"));
  const globalRoot = join(home, ".bapm");
  mkdirSync(join(globalRoot, "node_modules", "@b-apm"), { recursive: true });
  for (const id of [...FILE_HOSTS, "opencode"]) {
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

function writeGlobalFileLeaf(fx: GlobalFixture): void {
  const leaf = join(fx.globalRoot, "leaf");
  for (const dir of ["skills/hello", "instructions", "agents", "prompts", "hooks"]) {
    mkdirSync(join(leaf, ".apm", dir), { recursive: true });
  }
  writeFileSync(
    join(leaf, "bapm.yml"),
    "name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    "utf8",
  );
  writeFileSync(
    join(leaf, ".apm", "skills", "hello", "SKILL.md"),
    "---\nname: hello\ndescription: global skill\n---\n# hello\n",
    "utf8",
  );
  writeFileSync(
    join(leaf, ".apm", "instructions", "rule.md"),
    "---\napplyTo: src/**\n---\n# rule\n",
    "utf8",
  );
  writeFileSync(
    join(leaf, ".apm", "agents", "helper.md"),
    "---\nname: helper\ndescription: global agent\n---\n# helper\n",
    "utf8",
  );
  writeFileSync(
    join(leaf, ".apm", "prompts", "ship.prompt.md"),
    "---\ndescription: ship\n---\n# ship\n",
    "utf8",
  );
  writeFileSync(
    join(leaf, ".apm", "hooks", "audit.json"),
    `${JSON.stringify({ hooks: { SessionStart: [{ type: "command", command: "echo ok" }] } }, null, 2)}\n`,
    "utf8",
  );
}

function writeGlobalFileManifest(fx: GlobalFixture): void {
  const targets = FILE_HOSTS.map((id) => `  ${id}: "@b-apm/integration-${id}"`).join("\n");
  const active = FILE_HOSTS.map((id) => `    - ${id}`).join("\n");
  writeFileSync(
    join(fx.globalRoot, "bapm.yml"),
    [
      "name: global",
      "version: 0.1.0",
      "targets:",
      targets,
      "active:",
      "  target:",
      active,
      "dependencies:",
      "  apm:",
      "    - path: ./leaf",
      "",
    ].join("\n"),
    "utf8",
  );
}

function runGlobal(
  fx: GlobalFixture,
  argv: string[],
  env: Record<string, string | undefined> = {},
): ReturnType<typeof runInProject> {
  return runInProject(fx.project.cwd, argv, {
    HOME: fx.home,
    USERPROFILE: fx.home,
    XDG_CONFIG_HOME: join(fx.home, ".config"),
    ...env,
  });
}

describe("CLI global file install", () => {
  let fixture: GlobalFixture | undefined;

  afterEach(() => {
    fixture?.cleanup();
    fixture = undefined;
  });

  test("Cursor/Claude/Codex/agent-skills deploy into home; global root stays manifest/lock-only", async () => {
    fixture = createGlobalFixture();
    writeGlobalFileLeaf(fixture);
    writeGlobalFileManifest(fixture);

    const { result, combined } = await runGlobal(fixture, ["install", "--global"]);

    expect(result).toBe(0);
    expect(combined).toMatch(/installed for cursor, claude, codex, agent-skills.*global scope/i);

    // Shared user-level skills (Cursor, Codex, agent-skills).
    expect(existsSync(join(fixture.home, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
    // Cursor home harness layout.
    expect(existsSync(join(fixture.home, ".cursor", "rules", "rule.mdc"))).toBe(true);
    expect(existsSync(join(fixture.home, ".cursor", "agents", "helper.md"))).toBe(true);
    expect(existsSync(join(fixture.home, ".cursor", "commands", "ship.md"))).toBe(true);
    expect(existsSync(join(fixture.home, ".cursor", "hooks.json"))).toBe(true);
    // Claude home harness layout (own skills copy, rules, agents, commands, hooks).
    expect(existsSync(join(fixture.home, ".claude", "skills", "hello", "SKILL.md"))).toBe(true);
    expect(existsSync(join(fixture.home, ".claude", "rules", "rule.md"))).toBe(true);
    expect(existsSync(join(fixture.home, ".claude", "agents", "helper.md"))).toBe(true);
    expect(existsSync(join(fixture.home, ".claude", "commands", "ship.md"))).toBe(true);
    expect(existsSync(join(fixture.home, ".claude", "settings.json"))).toBe(true);
    // Codex home harness layout (agents + hooks; instructions/commands are compile-only).
    expect(existsSync(join(fixture.home, ".codex", "agents", "helper.toml"))).toBe(true);
    expect(existsSync(join(fixture.home, ".codex", "hooks.json"))).toBe(true);

    const lockPath = join(fixture.globalRoot, "bapm.lock.yaml");
    expect(existsSync(lockPath)).toBe(true);
    const lock = readFileSync(lockPath, "utf8");
    expect(lock).toContain(".cursor/commands/ship.md");
    expect(lock).toContain(".claude/commands/ship.md");
    expect(lock).toContain(".codex/agents/helper.toml");
    // Home-relative inventory, never absolute user paths.
    expect(lock).not.toContain(join(fixture.home, ".claude").replaceAll("\\", "/"));
    expect(lock).not.toContain(join(fixture.home, ".cursor").replaceAll("\\", "/"));

    // No project-shaped harness files in the global manifest root or cwd.
    for (const dir of [".cursor", ".claude", ".codex", ".agents"]) {
      expect(existsSync(join(fixture.globalRoot, dir))).toBe(false);
      expect(existsSync(join(fixture.project.cwd, dir))).toBe(false);
    }
    expect(existsSync(join(fixture.project.cwd, "bapm.yml"))).toBe(false);
    expect(existsSync(join(fixture.project.cwd, "bapm.lock.yaml"))).toBe(false);
  });

  test("frozen replays home-relative deployed hashes and detects drift", async () => {
    fixture = createGlobalFixture();
    writeGlobalFileLeaf(fixture);
    writeGlobalFileManifest(fixture);

    expect((await runGlobal(fixture, ["install", "--global"])).result).toBe(0);

    const replay = await runGlobal(fixture, ["install", "--global", "--frozen"]);
    expect(replay.result, replay.combined).toBe(0);

    const deployed = join(fixture.home, ".claude", "agents", "helper.md");
    writeFileSync(deployed, `${readFileSync(deployed, "utf8")}\nmanual edit\n`, "utf8");
    const drift = await runGlobal(fixture, ["install", "--global", "--frozen"]);
    expect(drift.result).not.toBe(0);
    expect(drift.combined).toMatch(/hash mismatch|integrity|deployed file/i);
  });

  test("global file install rejects a host without a user-scope layout", async () => {
    fixture = createGlobalFixture();
    const modulePath = join(fixture.globalRoot, "other-integration.mjs");
    writeFileSync(
      modulePath,
      [
        "export function createIntegration() {",
        '  return { id: "x-acme-other", deployRoots: [".other"], detect: () => false,',
        '    materialize: async () => ({ targetId: "x-acme-other", deployedFiles: [] }) };',
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
      "install",
      "--global",
      "--target",
      "x-acme-other",
    ]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/Global file install is not supported.*x-acme-other/i);
    expect(existsSync(join(fixture.home, ".other"))).toBe(false);
    expect(existsSync(join(fixture.globalRoot, ".other"))).toBe(false);
  });
});
