/**
 * p6c-lock-parity — lock-command / dependency-resolve CLI: parallel 0 + MCP carry.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  listFilesRecursive,
  readLockBytes,
  runInProject,
  writeLeafProject,
  writeText,
  type TempProject,
} from "./helpers.ts";

const MCP_MARKER = "p6c-cli-carry-server";

describe("p6c CLI bare lock flags and MCP carry", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("parallel-downloads 0 is accepted (serial semantics)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6c-parallel-0");

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "lock",
      "--parallel-downloads",
      "0",
    ]);

    expect(combined).not.toMatch(/invalid --parallel-downloads value:\s*0/i);
    expect(stderr.join("\n")).not.toMatch(/invalid --parallel-downloads/i);
    expect(result).toBe(0);
  });

  test("bare lock preserves mcp_* bags from existing lock", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6c-cli-mcp-carry");
    writeText(
      join(project.cwd, "bapm.lock.yaml"),
      `lockfile_version: "1"
generated_at: "2024-01-01T00:00:00Z"
dependencies:
  - name: leaf
    repo_url: local:leaf
    source: local
    version: "0.0.1"
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
`,
    );

    const { result } = await runInProject(project.cwd, ["lock"]);
    expect(result).toBe(0);

    const yaml = readLockBytes(project.cwd).toString("utf8");
    expect(yaml).toMatch(/mcp_servers/);
    expect(yaml).toMatch(new RegExp(MCP_MARKER));
    expect(yaml).toMatch(/mcp_configs/);
    expect(yaml).toMatch(/mcp_target_servers/);
    expect(yaml).toMatch(/mcp_config_provenance/);
  });

  test("bare lock does not deploy into harness dirs", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6c-cli-harness");
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeText(join(project.cwd, ".cursor", "keep.txt"), "x\n");
    const before = listFilesRecursive(join(project.cwd, ".cursor"));

    const { result } = await runInProject(project.cwd, ["lock"]);
    expect(result).toBe(0);
    expect(listFilesRecursive(join(project.cwd, ".cursor"))).toEqual(before);
  });
});
