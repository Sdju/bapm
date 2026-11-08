/**
 * User-scope (`bapm install --global --only mcp`) MCP deployment.
 *
 * - global project root is ~/.bapm (BAPM_HOME honored)
 * - Cursor → ~/.cursor/mcp.json, OpenCode → ~/.config/opencode/opencode.json
 * - global lock stays in ~/.bapm; project manifests/locks are untouched
 * - file primitives and unsupported hosts fail closed
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

const MCP_YAML = `  mcp:
    - name: global-stdio
      registry: false
      transport: stdio
      command: echo
      args: ["global"]
`;

type GlobalFixture = {
  project: TempProject;
  home: string;
  globalRoot: string;
  cleanup: () => void;
};

function createGlobalFixture(): GlobalFixture {
  const project = createTempProject("bapm-global-project-");
  const home = mkdtempSync(join(tmpdir(), "bapm-global-home-"));
  const globalRoot = join(home, ".bapm");
  mkdirSync(join(globalRoot, "node_modules", "@b-apm"), { recursive: true });
  for (const pkg of [
    "integration-cursor",
    "integration-opencode",
    "integration-claude",
    "integration-codex",
    "integration-agent-skills",
  ]) {
    linkPackageDir(globalRoot, join(PACKAGES_ROOT, pkg));
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

function writeGlobalManifest(
  fx: GlobalFixture,
  options: { targets?: string[]; mcp?: boolean } = {},
): void {
  const targets = options.targets ?? ["cursor", "opencode"];
  const targetLines = targets.map((id) => `  ${id}: "@b-apm/integration-${id}"`).join("\n");
  writeFileSync(
    join(fx.globalRoot, "bapm.yml"),
    [
      "name: global",
      "version: 0.1.0",
      "targets:",
      targetLines,
      "dependencies:",
      options.mcp === false ? "  apm: []" : `  apm: []\n${MCP_YAML.trimEnd()}`,
      "",
    ].join("\n"),
    "utf8",
  );
}

/** Local APM package exercising every deployable file primitive kind. */
function writeGlobalFileLeaf(fx: GlobalFixture): void {
  const leaf = join(fx.globalRoot, "leaf");
  mkdirSync(join(leaf, ".apm", "skills", "hello"), { recursive: true });
  mkdirSync(join(leaf, ".apm", "instructions"), { recursive: true });
  mkdirSync(join(leaf, ".apm", "agents"), { recursive: true });
  mkdirSync(join(leaf, ".apm", "prompts"), { recursive: true });
  mkdirSync(join(leaf, ".apm", "hooks"), { recursive: true });
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

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("CLI global MCP install", () => {
  let fixture: GlobalFixture | undefined;

  afterEach(() => {
    fixture?.cleanup();
    fixture = undefined;
  });

  test("Cursor: writes ~/.cursor/mcp.json and lock under ~/.bapm; project untouched", async () => {
    fixture = createGlobalFixture();
    writeGlobalManifest(fixture);

    const { result, combined } = await runGlobal(fixture, [
      "install",
      "--global",
      "--only",
      "mcp",
      "--target",
      "cursor",
    ]);

    expect(result).toBe(0);
    expect(combined).toMatch(/global scope/i);

    const cursorConfig = join(fixture.home, ".cursor", "mcp.json");
    expect(existsSync(cursorConfig)).toBe(true);
    expect(readJson(cursorConfig).mcpServers).toMatchObject({
      "global-stdio": { command: "echo" },
    });

    const lockPath = join(fixture.globalRoot, "bapm.lock.yaml");
    expect(existsSync(lockPath)).toBe(true);
    const lock = readFileSync(lockPath, "utf8");
    expect(lock).toContain("global-stdio");
    expect(lock).toContain(cursorConfig.replaceAll("\\", "/"));

    // Project is untouched: no project manifest, lock, or host config.
    expect(existsSync(join(fixture.project.cwd, "bapm.yml"))).toBe(false);
    expect(existsSync(join(fixture.project.cwd, "bapm.lock.yaml"))).toBe(false);
    expect(existsSync(join(fixture.project.cwd, ".cursor", "mcp.json"))).toBe(false);
  });

  test("OpenCode: writes ~/.config/opencode/opencode.json and global lock", async () => {
    fixture = createGlobalFixture();
    writeGlobalManifest(fixture);

    const { result, combined } = await runGlobal(fixture, [
      "install",
      "-g",
      "--mcp",
      "--target",
      "opencode",
    ]);

    expect(result).toBe(0);
    expect(combined).toMatch(/global scope/i);

    const opencodeConfig = join(fixture.home, ".config", "opencode", "opencode.json");
    expect(existsSync(opencodeConfig)).toBe(true);
    const doc = readJson(opencodeConfig) as {
      mcp?: Record<string, { type?: string; command?: string[] }>;
    };
    expect(doc.mcp?.["global-stdio"]).toMatchObject({
      type: "local",
      command: ["echo", "global"],
    });

    const lock = readFileSync(join(fixture.globalRoot, "bapm.lock.yaml"), "utf8");
    expect(lock).toContain("opencode");
    expect(lock).toContain("global-stdio");
    expect(existsSync(join(fixture.project.cwd, ".opencode"))).toBe(false);
  });

  test("global auto-detect uses the user host directory", async () => {
    fixture = createGlobalFixture();
    writeGlobalManifest(fixture);
    mkdirSync(join(fixture.home, ".cursor"), { recursive: true });

    const { result } = await runGlobal(fixture, ["install", "-g", "--only", "mcp"]);

    expect(result).toBe(0);
    expect(existsSync(join(fixture.home, ".cursor", "mcp.json"))).toBe(true);
    expect(existsSync(join(fixture.home, ".config", "opencode", "opencode.json"))).toBe(false);
  });

  test("BAPM_HOME overrides the global project root", async () => {
    fixture = createGlobalFixture();
    const customRoot = join(fixture.home, "custom-bapm-home");
    mkdirSync(join(customRoot, "node_modules", "@b-apm"), { recursive: true });
    linkPackageDir(customRoot, join(PACKAGES_ROOT, "integration-cursor"));
    const originalRoot = fixture.globalRoot;
    fixture.globalRoot = customRoot;
    writeGlobalManifest(fixture);

    const { result } = await runGlobal(
      fixture,
      ["install", "-g", "--only", "mcp", "--target", "cursor"],
      { BAPM_HOME: customRoot },
    );

    expect(result).toBe(0);
    expect(existsSync(join(customRoot, "bapm.lock.yaml"))).toBe(true);
    expect(existsSync(join(originalRoot, "bapm.lock.yaml"))).toBe(false);
    expect(existsSync(join(fixture.home, ".cursor", "mcp.json"))).toBe(true);
  });

  test("--global without --only mcp installs packages and Cursor file primitives", async () => {
    fixture = createGlobalFixture();
    writeGlobalFileLeaf(fixture);
    writeFileSync(
      join(fixture.globalRoot, "bapm.yml"),
      [
        "name: global",
        "version: 0.1.0",
        "targets:",
        '  cursor: "@b-apm/integration-cursor"',
        "dependencies:",
        "  apm:",
        "    - path: ./leaf",
        "",
      ].join("\n"),
      "utf8",
    );

    const { result, combined } = await runGlobal(fixture, ["install", "-g", "--target", "cursor"]);

    expect(result).toBe(0);
    expect(combined).toMatch(/global scope/i);
    expect(existsSync(join(fixture.home, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
    expect(existsSync(join(fixture.home, ".cursor", "rules", "rule.mdc"))).toBe(true);
    expect(existsSync(join(fixture.home, ".cursor", "agents", "helper.md"))).toBe(true);
    expect(existsSync(join(fixture.home, ".cursor", "commands", "ship.md"))).toBe(true);
    expect(existsSync(join(fixture.home, ".cursor", "hooks.json"))).toBe(true);
    expect(existsSync(join(fixture.globalRoot, "bapm.lock.yaml"))).toBe(true);
    // Nothing project-shaped is written under the global manifest root.
    expect(existsSync(join(fixture.globalRoot, ".cursor"))).toBe(false);
    expect(existsSync(join(fixture.project.cwd, ".cursor"))).toBe(false);
    expect(existsSync(join(fixture.project.cwd, "bapm.yml"))).toBe(false);
  });

  test("unsupported host fails with a clear global-MCP error", async () => {
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
        MCP_YAML.trimEnd(),
        "",
      ].join("\n"),
      "utf8",
    );

    const { result, combined } = await runGlobal(fixture, [
      "install",
      "-g",
      "--only",
      "mcp",
      "--target",
      "x-acme-other",
    ]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/Global MCP is not supported.*x-acme-other/i);
    expect(existsSync(join(fixture.globalRoot, "bapm.lock.yaml"))).toBe(true);
  });

  test("mcp list --global reports global scope and global lock inventory", async () => {
    fixture = createGlobalFixture();
    writeGlobalManifest(fixture);
    const install = await runGlobal(fixture, [
      "install",
      "-g",
      "--only",
      "mcp",
      "--target",
      "cursor",
    ]);
    expect(install.result).toBe(0);

    const { result, stdout, stderr } = await runGlobal(fixture, [
      "mcp",
      "list",
      "--global",
      "--json",
    ]);

    expect(result).toBe(0);
    expect(stderr.join("\n")).toBe("");
    const json = JSON.parse(stdout.join("\n")) as {
      scope?: string;
      root?: string;
      lockfile?: string;
      servers?: Array<{ name: string }>;
    };
    expect(json.scope).toBe("global");
    expect(json.root).toBe(fixture.globalRoot);
    expect(json.lockfile).toContain(join(fixture.globalRoot, "bapm.lock.yaml"));
    expect(json.servers?.map((server) => server.name)).toContain("global-stdio");
  });

  test("user deny still runs through the shared MCP pipeline (direct servers stay trusted)", async () => {
    fixture = createGlobalFixture();
    writeGlobalManifest(fixture);
    // A user-local deny for an unrelated package must not block direct global MCP,
    // and the shared trust/config path must still produce the host config.
    writeFileSync(
      join(fixture.globalRoot, "config.json"),
      `${JSON.stringify({ executables: { deny: { "some-other-package": { mcp: true } } } }, null, 2)}\n`,
      "utf8",
    );

    const { result } = await runGlobal(fixture, [
      "install",
      "-g",
      "--only",
      "mcp",
      "--target",
      "cursor",
    ]);

    expect(result).toBe(0);
    expect(readJson(join(fixture.home, ".cursor", "mcp.json")).mcpServers).toHaveProperty(
      "global-stdio",
    );
  });
});
