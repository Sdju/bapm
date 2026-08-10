/**
 * Materialize: skills → `.agents/skills/`; agents → `.codex/agents/*.toml`;
 * instruction/command/prompt skip; deploy-root containment; mkdir-on-write
 * (promoted from integration-codex-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MaterializeReport } from "@b-apm/integration-api";
import { createCodexIntegration } from "../src/createCodexIntegration.ts";

function reportDiagnostics(
  report: void | MaterializeReport | undefined,
): NonNullable<MaterializeReport["diagnostics"]> {
  if (report && typeof report === "object" && Array.isArray(report.diagnostics)) {
    return report.diagnostics;
  }
  return [];
}

describe("codex materialize", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("skill appears under .agents/skills/<name>/SKILL.md and not .codex/skills/", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-skill-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });
    const srcDir = join(cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: hello\n---\n# Hello\n", "utf8");

    const target = createCodexIntegration();
    await target.materialize(
      [{ name: "hello", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd, targetId: "codex", deployRoots: target.deployRoots },
    );

    const dest = join(cwd, ".agents", "skills", "hello", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Hello/);
    expect(existsSync(join(cwd, ".codex", "skills", "hello", "SKILL.md"))).toBe(false);
    expect(existsSync(join(cwd, ".codex", "config.toml"))).toBe(false);
  });

  test("portable Agent Plugins skill directory is fully copied", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-portable-skill-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });
    const pluginRoot = join(cwd, "plugin");
    const skillDir = join(pluginRoot, "skills", "example");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: example\n---\n# Example\n", "utf8");
    writeFileSync(join(skillDir, "guide.md"), "auxiliary skill file\n", "utf8");

    const target = createCodexIntegration();
    await target.materialize(
      [
        {
          name: "example",
          type: "skill",
          source: "local",
          path: join(skillDir, "SKILL.md"),
          format: "agent-plugin",
          skillDirectory: skillDir,
          pluginRoot,
        },
      ],
      { cwd, targetId: "codex", deployRoots: target.deployRoots },
    );

    expect(readFileSync(join(cwd, ".agents", "skills", "example", "guide.md"), "utf8")).toBe(
      "auxiliary skill file\n",
    );
    expect(existsSync(join(cwd, ".agents", "skills", "example", "SKILL.md"))).toBe(true);
    expect(existsSync(join(cwd, ".codex", "skills", "example", "SKILL.md"))).toBe(false);
  });

  test("agent becomes .codex/agents/<name>.toml with name/description/developer_instructions", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-agent-toml-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });
    const agentSrc = join(cwd, "scout.md");
    writeFileSync(
      agentSrc,
      "---\nname: scout\ndescription: Finds things\n---\n# Scout body\nDo recon.\n",
      "utf8",
    );

    const target = createCodexIntegration();
    await target.materialize([{ name: "scout", type: "agent", source: "local", path: agentSrc }], {
      cwd,
      targetId: "codex",
      deployRoots: target.deployRoots,
    });

    const dest = join(cwd, ".codex", "agents", "scout.toml");
    expect(existsSync(dest)).toBe(true);
    const body = readFileSync(dest, "utf8");
    expect(body).toMatch(/name\s*=\s*"scout"/);
    expect(body).toMatch(/description\s*=\s*"Finds things"/);
    expect(body).toMatch(/developer_instructions\s*=/);
    expect(body).toMatch(/Scout body|Do recon/);
    expect(existsSync(join(cwd, ".codex", "config.toml"))).toBe(false);
  });

  test("tools frontmatter is dropped with diagnostic", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-agent-tools-drop-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });
    const agentSrc = join(cwd, "toolsy.md");
    writeFileSync(
      agentSrc,
      "---\nname: toolsy\ndescription: Has tools\ntools:\n  - Read\n  - Write\n---\n# Body\n",
      "utf8",
    );

    const target = createCodexIntegration();
    const report = await target.materialize(
      [{ name: "toolsy", type: "agent", source: "local", path: agentSrc }],
      { cwd, targetId: "codex", deployRoots: target.deployRoots },
    );

    const dest = join(cwd, ".codex", "agents", "toolsy.toml");
    expect(existsSync(dest)).toBe(true);
    const body = readFileSync(dest, "utf8");
    expect(body).not.toMatch(/\btools\b\s*=/);
    expect(body).not.toMatch(/^tools\s*=/m);
    const diags = reportDiagnostics(report);
    expect(diags.length).toBeGreaterThan(0);
    expect(
      diags.some(
        (d) =>
          /tools/i.test(d.message) ||
          /tools/i.test(String(d.code ?? "")) ||
          /lossy|drop/i.test(d.message),
      ),
    ).toBe(true);
  });

  test("instruction does not write a Codex-native rules file under .codex/", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-skip-instruction-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });
    const src = join(cwd, "style.md");
    writeFileSync(src, "# Style rule\n", "utf8");

    const target = createCodexIntegration();
    const report = await target.materialize(
      [{ name: "style", type: "instruction", source: "local", path: src }],
      { cwd, targetId: "codex", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(cwd, ".codex", "rules", "style.md"))).toBe(false);
    expect(existsSync(join(cwd, ".codex", "instructions", "style.md"))).toBe(false);
    expect(existsSync(join(cwd, ".cursor", "rules", "style.mdc"))).toBe(false);
    const diags = reportDiagnostics(report);
    expect(diags.length).toBeGreaterThan(0);
  });

  test("command and prompt do not write native host files", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-skip-cmd-prompt-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });
    const cmdSrc = join(cwd, "review.md");
    const promptSrc = join(cwd, "ask.md");
    writeFileSync(cmdSrc, "---\ndescription: review\n---\n# Review\n", "utf8");
    writeFileSync(promptSrc, "# Ask\n", "utf8");

    const target = createCodexIntegration();
    const report = await target.materialize(
      [
        { name: "review", type: "command", source: "local", path: cmdSrc },
        { name: "ask", type: "prompt", source: "local", path: promptSrc },
      ],
      { cwd, targetId: "codex", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(cwd, ".codex", "commands", "review.md"))).toBe(false);
    expect(existsSync(join(cwd, ".codex", "prompts", "ask.md"))).toBe(false);
    expect(existsSync(join(cwd, ".agents", "commands", "review.md"))).toBe(false);
    const diags = reportDiagnostics(report);
    expect(diags.length).toBeGreaterThan(0);
  });

  test("materialize refuses escapes outside deploy roots", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-escape-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });
    const srcDir = join(cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: escape\n---\n# Escape\n", "utf8");

    const target = createCodexIntegration();
    await expect(
      target.materialize(
        [{ name: "escape", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
        { cwd, targetId: "codex", deployRoots: [".codex"] },
      ),
    ).rejects.toThrow();
    expect(existsSync(join(cwd, ".agents", "skills", "escape", "SKILL.md"))).toBe(false);
  });

  test("forced codex materialize may create .agents/.codex roots when absent", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-force-roots-"));
    const srcDir = join(cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: forced\n---\n# Forced\n", "utf8");

    const target = createCodexIntegration();
    expect(existsSync(join(cwd, ".codex"))).toBe(false);
    expect(existsSync(join(cwd, ".agents"))).toBe(false);

    await target.materialize(
      [{ name: "forced", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd, targetId: "codex", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(cwd, ".agents", "skills", "forced", "SKILL.md"))).toBe(true);
  });
});
