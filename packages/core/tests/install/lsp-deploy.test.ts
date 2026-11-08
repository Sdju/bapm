/**
 * `dependencies.lsp` deploy through host-owned configureLsp:
 * Claude `.claude/skills/apm-lsp/.claude-plugin/plugin.json`,
 * Copilot `.github/lsp.json`, trust `lsp`, lock inventory, stale removal.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createIntegrationRegistry } from "@b-apm/integration-api";
import { createClaudeIntegration } from "../../../integration-claude/src/createClaudeIntegration.ts";
import { createCopilotIntegration } from "../../../integration-copilot/src/createCopilotIntegration.ts";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { loadLockfile, runInstall } from "../../src/index.ts";
import { createTempProject, type TempProject } from "./ux-helpers.ts";

const CLAUDE_LSP = join(".claude", "skills", "apm-lsp", ".claude-plugin", "plugin.json");
const COPILOT_LSP = join(".github", "lsp.json");

const ROOT_LSP = `dependencies:
  lsp:
    - name: gopls
      command: gopls
      args: [serve]
      extensionToLanguage:
        .go: go
`;

const TWO_LSP = `dependencies:
  lsp:
    - name: gopls
      command: gopls
      args: [serve]
      extensionToLanguage:
        .go: go
    - name: pyright
      command: pyright-langserver
      args: [--stdio]
      extensionToLanguage:
        .py: python
`;

const DEP_LSP = `name: rid-lsp
version: 0.0.1
dependencies:
  apm: []
  lsp:
    - name: yaml-ls
      command: yaml-language-server
      args: [--stdio]
      extensionToLanguage:
        .yaml: yaml
        .yml: yaml
`;

type Diagnostic = Record<string, unknown>;

function writeRoot(cwd: string, body: string): void {
  writeFileSync(join(cwd, "bapm.yml"), `name: rid-root\nversion: 0.0.1\n${body}`, "utf8");
}

function writeDepProject(cwd: string, grants = ""): void {
  mkdirSync(join(cwd, "leaf"), { recursive: true });
  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: rid-dep-root
version: 0.0.1
${grants}dependencies:
  apm:
    - path: ./leaf
`,
    "utf8",
  );
  writeFileSync(join(cwd, "leaf", "bapm.yml"), DEP_LSP, "utf8");
}

function createRegistry(options: { claude?: boolean; copilot?: boolean; cursor?: boolean } = {}) {
  const registry = createIntegrationRegistry();
  if (options.claude !== false) registry.register(createClaudeIntegration());
  if (options.copilot !== false) registry.register(createCopilotIntegration());
  if (options.cursor) {
    registry.register({
      id: "cursor",
      deployRoots: [".cursor"],
      detect: () => false,
      materialize: async () => ({ targetId: "cursor", deployedFiles: [] }),
    });
  }
  return registry;
}

async function install(
  cwd: string,
  target: string,
  options: { frozen?: boolean; registry?: ReturnType<typeof createRegistry> } = {},
): Promise<unknown> {
  const registry = options.registry ?? createRegistry({ cursor: true });
  return runInstall({
    cwd,
    frozen: options.frozen === true,
    noPolicy: true,
    activeTargets: [target],
    integrationRegistry: registry,
    registry,
  });
}

function diagnosticsByCode(result: unknown, code: string): Diagnostic[] {
  const diagnostics = (result as { diagnostics?: unknown })?.diagnostics;
  if (!Array.isArray(diagnostics)) return [];
  return diagnostics.filter(
    (item): item is Diagnostic =>
      Boolean(item) && typeof item === "object" && (item as Diagnostic).code === code,
  );
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function lockDoc(cwd: string): Record<string, unknown> {
  return loadLockfile({ cwd }).document as Record<string, unknown>;
}

describe("install LSP deploy", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("root dependencies.lsp deploys to Claude with lock inventory", async () => {
    project = createTempProject("bapm-lsp-claude-");
    writeRoot(project.cwd, ROOT_LSP);

    const result = await install(project.cwd, "claude");

    expect(result).toMatchObject({ ok: true });
    const path = join(project.cwd, CLAUDE_LSP);
    expect(existsSync(path)).toBe(true);
    const doc = readJson(path);
    expect(doc.name).toBe("apm-lsp");
    expect((doc.lspServers as Record<string, unknown>).gopls).toMatchObject({
      command: "gopls",
      extensionToLanguage: { ".go": "go" },
    });

    const lock = lockDoc(project.cwd);
    expect(lock.lsp_servers).toEqual(["gopls"]);
    expect(lock.lsp_target_servers).toEqual({ claude: ["gopls"] });
    expect(lock.lsp_config_provenance).toEqual({ gopls: "project:." });
    expect((lock.lsp_configs as Record<string, unknown>).gopls).toMatchObject({
      name: "gopls",
      command: "gopls",
    });
    expect(diagnosticsByCode(result, "LSP_UNSUPPORTED")).toEqual([]);
  });

  test("root dependencies.lsp deploys to Copilot native lsp.json", async () => {
    project = createTempProject("bapm-lsp-copilot-");
    writeRoot(project.cwd, ROOT_LSP);

    const result = await install(project.cwd, "copilot");

    expect(result).toMatchObject({ ok: true });
    const doc = readJson(join(project.cwd, COPILOT_LSP));
    expect((doc.lspServers as Record<string, unknown>).gopls).toMatchObject({
      command: "gopls",
      args: ["serve"],
      fileExtensions: { ".go": "go" },
    });
    expect(diagnosticsByCode(result, "LSP_UNSUPPORTED")).toEqual([]);
    expect(lockDoc(project.cwd).lsp_target_servers).toEqual({ copilot: ["gopls"] });
  });

  test("dependency LSP deploys when grants allow lsp", async () => {
    project = createTempProject("bapm-lsp-allow-");
    writeDepProject(
      project.cwd,
      `executables:
  allow:
    rid-lsp:
      lsp: true
`,
    );

    const result = await install(project.cwd, "claude");

    expect(result).toMatchObject({ ok: true });
    const doc = readJson(join(project.cwd, CLAUDE_LSP));
    expect((doc.lspServers as Record<string, unknown>)["yaml-ls"]).toMatchObject({
      command: "yaml-language-server",
    });
    expect(lockDoc(project.cwd).lsp_config_provenance).toEqual({
      "yaml-ls": "package:rid-lsp",
    });
  });

  test("explicit deny stays fatal and writes no LSP config", async () => {
    project = createTempProject("bapm-lsp-deny-");
    writeDepProject(
      project.cwd,
      `executables:
  deny:
    rid-lsp:
      lsp: true
`,
    );

    await expect(install(project.cwd, "claude")).rejects.toMatchObject({
      code: "INSTALL_LSP_TRUST",
    });
    expect(existsSync(join(project.cwd, CLAUDE_LSP))).toBe(false);
  });

  test("mentioned-but-unapproved dependency withholds instead of silently skipping", async () => {
    project = createTempProject("bapm-lsp-withhold-");
    writeDepProject(
      project.cwd,
      `executables:
  allow:
    rid-lsp:
      mcp: true
`,
    );

    await expect(install(project.cwd, "claude")).rejects.toThrow(/LSP withheld/i);
    expect(existsSync(join(project.cwd, CLAUDE_LSP))).toBe(false);
  });

  test("unrelated allow skips unapproved dependency LSP with LSP_NOT_APPROVED", async () => {
    project = createTempProject("bapm-lsp-skip-");
    writeDepProject(
      project.cwd,
      `executables:
  allow:
    acme/other:
      lsp: true
`,
    );

    const result = await install(project.cwd, "claude");

    expect(result).toMatchObject({ ok: true });
    expect(existsSync(join(project.cwd, CLAUDE_LSP))).toBe(false);
    const warnings = diagnosticsByCode(result, "LSP_NOT_APPROVED");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      packageName: "rid-lsp",
      warn: true,
      skip: true,
    });
    expect(diagnosticsByCode(result, "LSP_TRUST_WITHHOLD")).toEqual([]);
  });

  test("invalid entries fail closed before any host write", async () => {
    project = createTempProject("bapm-lsp-invalid-");
    writeRoot(project.cwd, `dependencies:\n  lsp:\n    - pyright\n`);

    await expect(install(project.cwd, "claude")).rejects.toMatchObject({
      code: "INSTALL_LSP_INVALID",
    });
    expect(existsSync(join(project.cwd, CLAUDE_LSP))).toBe(false);
  });

  test("reinstall is idempotent for host config and lock inventory", async () => {
    project = createTempProject("bapm-lsp-idempotent-");
    writeRoot(project.cwd, ROOT_LSP);
    const registry = createRegistry();

    await install(project.cwd, "claude", { registry });
    const firstHost = readFileSync(join(project.cwd, CLAUDE_LSP), "utf8");
    const firstLock = lockDoc(project.cwd);

    await install(project.cwd, "claude", { registry });

    expect(readFileSync(join(project.cwd, CLAUDE_LSP), "utf8")).toBe(firstHost);
    const secondLock = lockDoc(project.cwd);
    expect(secondLock.lsp_servers).toEqual(firstLock.lsp_servers);
    expect(secondLock.lsp_configs).toEqual(firstLock.lsp_configs);
    expect(secondLock.lsp_target_servers).toEqual(firstLock.lsp_target_servers);
    expect(secondLock.lsp_config_provenance).toEqual(firstLock.lsp_config_provenance);
  });

  test("removing a declaration removes the stale owned host entry and lock name", async () => {
    project = createTempProject("bapm-lsp-stale-");
    writeRoot(project.cwd, TWO_LSP);
    const registry = createRegistry();

    await install(project.cwd, "claude", { registry });
    expect(Object.keys(readJson(join(project.cwd, CLAUDE_LSP)).lspServers as object)).toEqual([
      "gopls",
      "pyright",
    ]);

    writeRoot(project.cwd, ROOT_LSP);
    await install(project.cwd, "claude", { registry });

    const doc = readJson(join(project.cwd, CLAUDE_LSP));
    expect(Object.keys(doc.lspServers as object)).toEqual(["gopls"]);
    const lock = lockDoc(project.cwd);
    expect(lock.lsp_servers).toEqual(["gopls"]);
    expect(lock.lsp_target_servers).toEqual({ claude: ["gopls"] });
    expect(lock.lsp_config_provenance).toEqual({ gopls: "project:." });
  });

  test("stale cleanup also reaches previously configured inactive hosts", async () => {
    project = createTempProject("bapm-lsp-stale-inactive-");
    writeRoot(project.cwd, TWO_LSP);
    const registry = createRegistry();

    await runInstall({
      cwd: project.cwd,
      noPolicy: true,
      activeTargets: ["claude", "copilot"],
      integrationRegistry: registry,
      registry,
    });
    expect(Object.keys(readJson(join(project.cwd, COPILOT_LSP)).lspServers as object)).toEqual([
      "gopls",
      "pyright",
    ]);

    writeRoot(project.cwd, ROOT_LSP);
    await install(project.cwd, "claude", { registry });

    expect(Object.keys(readJson(join(project.cwd, COPILOT_LSP)).lspServers as object)).toEqual([
      "gopls",
    ]);
    expect(lockDoc(project.cwd).lsp_target_servers).toEqual({
      claude: ["gopls"],
      copilot: ["gopls"],
    });
  });

  test("unsupported host keeps LSP_UNSUPPORTED warning and writes nothing", async () => {
    project = createTempProject("bapm-lsp-cursor-");
    writeRoot(project.cwd, ROOT_LSP);

    const result = await install(project.cwd, "cursor", {
      registry: createRegistry({ cursor: true }),
    });

    expect(result).toMatchObject({ ok: true });
    const warnings = diagnosticsByCode(result, "LSP_UNSUPPORTED");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      packageName: "rid-root",
      servers: ["gopls"],
      deploy: false,
      warn: true,
    });
    expect(existsSync(join(project.cwd, CLAUDE_LSP))).toBe(false);
    expect(existsSync(join(project.cwd, COPILOT_LSP))).toBe(false);
    const lock = lockDoc(project.cwd);
    expect(lock.lsp_servers).toBeUndefined();
    expect(lock.lsp_target_servers).toBeUndefined();
  });

  test("frozen supported host redeploys config but leaves lock inventory untouched", async () => {
    project = createTempProject("bapm-lsp-frozen-");
    writeRoot(project.cwd, ROOT_LSP);
    const registry = createRegistry();

    await install(project.cwd, "claude", { registry });
    const path = join(project.cwd, CLAUDE_LSP);
    expect(existsSync(path)).toBe(true);
    const lockBefore = readFileSync(
      join(
        project.cwd,
        existsSync(join(project.cwd, "bapm.lock.yaml")) ? "bapm.lock.yaml" : "apm.lock.yaml",
      ),
      "utf8",
    );

    const { rmSync } = await import("node:fs");
    rmSync(path);

    await install(project.cwd, "claude", { frozen: true, registry });

    expect(existsSync(path)).toBe(true);
    const lockAfter = readFileSync(
      join(
        project.cwd,
        existsSync(join(project.cwd, "bapm.lock.yaml")) ? "bapm.lock.yaml" : "apm.lock.yaml",
      ),
      "utf8",
    );
    expect(lockAfter).toBe(lockBefore);
  });

  test("frozen unsupported host warns and writes nothing", async () => {
    project = createTempProject("bapm-lsp-frozen-unsupported-");
    writeRoot(project.cwd, ROOT_LSP);
    const registry = createRegistry({ cursor: true });

    await install(project.cwd, "cursor", { registry });
    const result = await install(project.cwd, "cursor", { frozen: true, registry });

    expect(diagnosticsByCode(result, "LSP_UNSUPPORTED")).toHaveLength(1);
    expect(existsSync(join(project.cwd, CLAUDE_LSP))).toBe(false);
    expect(existsSync(join(project.cwd, COPILOT_LSP))).toBe(false);
  });
});
