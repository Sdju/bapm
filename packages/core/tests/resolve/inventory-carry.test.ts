/**
 * dependency-resolve: inventory bag carry on lock rewrite.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadLockfile, resolveAndLock, serializeLockfile } from "@bapm/core";
import { createTempProject, writeText, type TempProject } from "./helpers.ts";

const MCP_MARKER = "carry-server";

function writeLeafProject(cwd: string, name: string): void {
  writeText(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
  );
  writeText(join(cwd, "leaf", "apm.yml"), `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
}

function readLockYaml(cwd: string): string {
  for (const name of ["bapm.lock.yaml", "apm.lock.yaml"] as const) {
    const p = join(cwd, name);
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  throw new Error(`no lockfile in ${cwd}`);
}

describe("lock rewrite inventory carry-forward", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("mcp_* bags survive resolveAndLock rewrite", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6c-carry");
    writeText(
      join(project.cwd, "bapm.lock.yaml"),
      `lockfile_version: "1"
generated_at: "2024-01-01T00:00:00Z"
dependencies:
  - name: leaf
    repo_url: local:leaf
    source: local
    version: "0.0.1"
    deployed_file_hashes:
      skills/x/SKILL.md: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
mcp_servers:
  ${MCP_MARKER}:
    command: echo
    args: ["hi"]
mcp_configs:
  ${MCP_MARKER}:
    transport: stdio
mcp_target_servers:
  cursor:
    - ${MCP_MARKER}
mcp_config_provenance:
  ${MCP_MARKER}: install
deployments:
  cursor:
    - leaf
lsp_servers:
  demo-lsp:
    command: true
x_custom_inventory:
  keep: true
`,
    );

    await resolveAndLock({ cwd: project.cwd });

    const loaded = loadLockfile({ cwd: project.cwd });
    const doc = loaded.document as Record<string, unknown>;
    expect(doc.mcp_servers).toBeTruthy();
    expect(JSON.stringify(doc.mcp_servers)).toMatch(new RegExp(MCP_MARKER));
    expect(doc.mcp_configs).toBeTruthy();
    expect(doc.mcp_target_servers).toBeTruthy();
    expect(doc.mcp_config_provenance).toBeTruthy();
    expect(doc.deployments).toBeTruthy();
    expect(doc.lsp_servers).toBeTruthy();
    expect(doc.x_custom_inventory).toEqual({ keep: true });

    const yaml = readLockYaml(project.cwd);
    expect(yaml).toMatch(/mcp_servers/);
    expect(yaml).toMatch(new RegExp(MCP_MARKER));
  });

  test("absent MCP is not invented on lock-only rewrite", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6c-no-mcp");
    writeText(
      join(project.cwd, "bapm.lock.yaml"),
      `lockfile_version: "1"
dependencies:
  - name: leaf
    repo_url: local:leaf
    source: local
    version: "0.0.1"
`,
    );

    await resolveAndLock({ cwd: project.cwd });

    const yaml = readLockYaml(project.cwd);
    expect(yaml).not.toMatch(/mcp_servers:/);
    expect(yaml).not.toMatch(/mcp_configs:/);
    const doc = loadLockfile({ cwd: project.cwd }).document as Record<string, unknown>;
    expect(doc.mcp_servers == null || doc.mcp_servers === undefined).toBe(true);
  });

  test("deployed_file_hashes still carried for kept identities", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6c-hashes");
    const hash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    writeText(
      join(project.cwd, "bapm.lock.yaml"),
      `lockfile_version: "1"
dependencies:
  - name: leaf
    repo_url: local:leaf
    source: local
    version: "0.0.1"
    deployed_file_hashes:
      skills/x/SKILL.md: "${hash}"
`,
    );

    await resolveAndLock({ cwd: project.cwd });

    const deps = loadLockfile({ cwd: project.cwd }).document.dependencies;
    const leaf = deps.find((d) => String(d.repo_url).includes("leaf") || d.name === "leaf");
    expect(leaf?.deployed_file_hashes).toBeTruthy();
    expect(String(leaf?.deployed_file_hashes?.["skills/x/SKILL.md"])).toMatch(new RegExp(hash));
  });

  test("serialize still emits carried mcp_* when present on document", () => {
    const yaml = serializeLockfile({
      lockfile_version: "1",
      dependencies: [],
      mcp_servers: { [MCP_MARKER]: { command: "echo" } },
    });
    expect(yaml).toMatch(/mcp_servers/);
    expect(yaml).toMatch(new RegExp(MCP_MARKER));
  });
});
