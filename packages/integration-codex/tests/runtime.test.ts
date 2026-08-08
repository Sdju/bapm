/**
 * Unit coverage for Codex runtime detect / materialize / hooks / MCP / compile.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { createCodexIntegration } from "../src/createCodexIntegration.ts";

type Temp = { cwd: string; cleanup: () => void };

function tempProject(): Temp {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-codex-unit-"));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

describe("createCodexIntegration unit", () => {
  let project: Temp | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("detect is true only for .codex/ directory", async () => {
    project = tempProject();
    const target = createCodexIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    writeFileSync(join(project.cwd, "AGENTS.md"), "# x\n", "utf8");
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    mkdirSync(join(project.cwd, ".codex"), { recursive: true });
    expect(await target.detect({ cwd: project.cwd })).toBe(true);
  });

  test("materialize skill/agent and skips instruction with diagnostic", async () => {
    project = tempProject();
    mkdirSync(join(project.cwd, ".codex"), { recursive: true });
    const skillDir = join(project.cwd, "skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: s\n---\n# Skill\n", "utf8");
    writeFileSync(
      join(project.cwd, "agent.md"),
      "---\nname: a\ndescription: d\ntools:\n  - Read\n---\nBody\n",
      "utf8",
    );
    writeFileSync(join(project.cwd, "rule.md"), "# rule\n", "utf8");

    const target = createCodexIntegration();
    const report = await target.materialize(
      [
        { name: "s", type: "skill", source: "local", path: join(skillDir, "SKILL.md") },
        { name: "a", type: "agent", source: "local", path: join(project.cwd, "agent.md") },
        { name: "rule", type: "instruction", source: "local", path: join(project.cwd, "rule.md") },
      ],
      { cwd: project.cwd, targetId: "codex", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(project.cwd, ".agents", "skills", "s", "SKILL.md"))).toBe(true);
    const agentToml = readFileSync(join(project.cwd, ".codex", "agents", "a.toml"), "utf8");
    expect(agentToml).toMatch(/name\s*=\s*"a"/);
    expect(agentToml).not.toMatch(/\btools\b\s*=/);
    expect(existsSync(join(project.cwd, ".codex", "rules"))).toBe(false);
    expect(report?.diagnostics?.length).toBeGreaterThan(0);
  });

  test("hooks sidecar reinstall replaces owned entries only", async () => {
    project = tempProject();
    mkdirSync(join(project.cwd, ".codex"), { recursive: true });
    writeFileSync(
      join(project.cwd, ".codex", "hooks.json"),
      JSON.stringify({
        hooks: { SessionStart: [{ type: "command", command: "./keep.sh" }] },
      }),
      "utf8",
    );
    mkdirSync(join(project.cwd, "pkg"), { recursive: true });
    writeFileSync(join(project.cwd, "pkg", "v1.sh"), "#!/bin/sh\necho v1\n", "utf8");
    writeFileSync(join(project.cwd, "pkg", "v2.sh"), "#!/bin/sh\necho v2\n", "utf8");
    const hookV1 = join(project.cwd, "pkg", "h1.json");
    const hookV2 = join(project.cwd, "pkg", "h2.json");
    writeFileSync(
      hookV1,
      JSON.stringify({ hooks: { SessionStart: [{ type: "command", command: "./v1.sh" }] } }),
      "utf8",
    );
    writeFileSync(
      hookV2,
      JSON.stringify({ hooks: { SessionStart: [{ type: "command", command: "./v2.sh" }] } }),
      "utf8",
    );

    const target = createCodexIntegration();
    const ctx = { cwd: project.cwd, targetId: "codex", deployRoots: target.deployRoots };
    await target.materialize([{ name: "h", type: "hook", source: "local", path: hookV1 }], ctx);
    await target.materialize([{ name: "h", type: "hook", source: "local", path: hookV2 }], ctx);

    const doc = JSON.parse(readFileSync(join(project.cwd, ".codex", "hooks.json"), "utf8")) as {
      hooks: { SessionStart: Array<{ command?: string }> };
    };
    const cmds = doc.hooks.SessionStart.map((e) => e.command ?? "");
    expect(cmds.some((c) => c === "./keep.sh")).toBe(true);
    expect(cmds.some((c) => c.includes("v2.sh"))).toBe(true);
    expect(cmds.some((c) => c.includes("v1.sh"))).toBe(false);
    expect(existsSync(join(project.cwd, ".codex", "bapm-hooks.json"))).toBe(true);
  });

  test("configureMcp writes stdio, rejects SSE, skips malformed", async () => {
    project = tempProject();
    mkdirSync(join(project.cwd, ".codex"), { recursive: true });
    const target = createCodexIntegration();
    const ctx = { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "codex" };

    const ok = await target.configureMcp!(
      [{ name: "stdio-s", transport: "stdio", command: "echo" }],
      ctx,
    );
    expect(ok.servers).toContain("stdio-s");
    expect(readFileSync(join(project.cwd, ".codex", "config.toml"), "utf8")).toMatch(/stdio-s/);

    const sse = await target.configureMcp!(
      [{ name: "sse-s", transport: "sse", url: "https://example.test/sse" }],
      ctx,
    );
    expect(sse.servers ?? []).not.toContain("sse-s");
    expect(sse.diagnostics?.length).toBeGreaterThan(0);

    const brokenPath = join(project.cwd, ".codex", "config.toml");
    writeFileSync(brokenPath, "[[[broken\n", "utf8");
    const skip = await target.configureMcp!(
      [{ name: "skip-me", transport: "stdio", command: "true" }],
      ctx,
    );
    expect(readFileSync(brokenPath, "utf8")).toBe("[[[broken\n");
    expect(skip.servers ?? []).not.toContain("skip-me");
  });

  test("compile includes instructions and honors write=false", async () => {
    project = tempProject();
    writeFileSync(join(project.cwd, "s.md"), "# Skill Unique\n", "utf8");
    writeFileSync(join(project.cwd, "i.md"), "# Instr Unique\n", "utf8");
    const target = createCodexIntegration();
    const compile = target.compile!;
    const preview = await compile(
      [
        { name: "s", type: "skill", source: "local", path: join(project.cwd, "s.md") },
        { name: "i", type: "instruction", source: "local", path: join(project.cwd, "i.md") },
      ],
      { cwd: project.cwd, write: false },
    );
    expect(preview.wrote).toBe(false);
    expect(preview.content).toMatch(/Skill Unique/);
    expect(preview.content).toMatch(/Instr Unique/);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });
});
