import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createClaudeIntegration,
  transformClaudeRulesMarkdown,
} from "../src/createClaudeIntegration.ts";
import { createIntegration, mapClaudeMarketplace } from "../src/index.ts";

describe("createClaudeIntegration", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("createIntegration alias matches createClaudeIntegration id", () => {
    expect(createIntegration().id).toBe("claude");
    expect(createClaudeIntegration().deployRoots).toEqual(expect.arrayContaining([".claude", "."]));
  });

  test("transformClaudeRulesMarkdown maps applyTo list to paths", () => {
    const out = transformClaudeRulesMarkdown(
      '---\napplyTo:\n  - "**/*.ts"\n  - "src/**"\n---\n# Body\n',
    );
    expect(out).toMatch(/^paths:\s*$/m);
    expect(out).toMatch(/\*\*\/\*\.ts/);
    expect(out).not.toMatch(/^applyTo:/m);
  });

  test("transformClaudeRulesMarkdown leaves unconditional body without paths", () => {
    const out = transformClaudeRulesMarkdown("# Only body\n");
    expect(out).toBe("# Only body\n");
    expect(out).not.toMatch(/^paths:/m);
  });

  test("detect false does not create .claude or CLAUDE.md", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-unit-detect-"));
    const target = createClaudeIntegration();
    expect(await target.detect({ cwd })).toBe(false);
    expect(existsSync(join(cwd, ".claude"))).toBe(false);
    expect(existsSync(join(cwd, "CLAUDE.md"))).toBe(false);
  });

  test("configureMcp rewrites .agents/skills launcher prefix", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-unit-mcp-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    const target = createClaudeIntegration();
    await target.configureMcp!(
      [{ name: "s", transport: "stdio", command: ".agents/skills/x/run.sh" }],
      { cwd, deployRoots: target.deployRoots, targetId: "claude" },
    );
    const doc = JSON.parse(readFileSync(join(cwd, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, { command?: string }>;
    };
    expect(doc.mcpServers.s?.command).toBe(".claude/skills/x/run.sh");
  });

  test("hooks reinstall strips previously owned commands via sidecar", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-unit-hooks-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    mkdirSync(join(cwd, "pkg"), { recursive: true });
    writeFileSync(join(cwd, "pkg", "a.sh"), "#!/bin/sh\necho a\n", "utf8");
    writeFileSync(join(cwd, "pkg", "b.sh"), "#!/bin/sh\necho b\n", "utf8");
    const hookA = join(cwd, "pkg", "a.json");
    const hookB = join(cwd, "pkg", "b.json");
    writeFileSync(
      hookA,
      JSON.stringify({ hooks: { SessionStart: [{ type: "command", command: "./a.sh" }] } }),
      "utf8",
    );
    writeFileSync(
      hookB,
      JSON.stringify({ hooks: { SessionStart: [{ type: "command", command: "./b.sh" }] } }),
      "utf8",
    );

    const target = createClaudeIntegration();
    const ctx = { cwd, targetId: "claude", deployRoots: target.deployRoots };
    await target.materialize([{ name: "h", type: "hook", source: "local", path: hookA }], ctx);
    await target.materialize([{ name: "h", type: "hook", source: "local", path: hookB }], ctx);

    const settings = JSON.parse(readFileSync(join(cwd, ".claude", "settings.json"), "utf8")) as {
      hooks: { SessionStart: Array<{ command?: string }> };
    };
    const cmds = (settings.hooks.SessionStart ?? []).map((e) => e.command ?? "");
    expect(cmds.some((c) => c.includes("b.sh"))).toBe(true);
    expect(cmds.some((c) => c.includes("a.sh"))).toBe(false);
  });

  test("marketplace mapper still exported", () => {
    expect(mapClaudeMarketplace({ name: "M", owner: "O" }, [])).toMatchObject({
      name: "M",
      plugins: [],
    });
  });
});
