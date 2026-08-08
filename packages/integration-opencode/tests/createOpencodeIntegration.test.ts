/**
 * @bapm/integration-opencode package identity and basic materialize.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createIntegration, createOpencodeIntegration } from "../src/index.ts";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("@bapm/integration-opencode package", () => {
  test("package is @bapm/integration-opencode depending on @bapm/integration-api only", () => {
    expect(existsSync(pkgRoot)).toBe(true);
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      name?: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.name).toBe("@bapm/integration-opencode");
    expect(pkg.dependencies?.["@bapm/integration-api"]).toBeTruthy();
    expect(pkg.dependencies?.["@bapm/core"]).toBeUndefined();
    expect(JSON.stringify(pkg.scripts ?? {})).toMatch(/vp/);
  });

  test("createIntegration aliases createOpencodeIntegration", () => {
    expect(createIntegration).toBe(createOpencodeIntegration);
    expect(createOpencodeIntegration().id).toBe("opencode");
  });
});

describe("createOpencodeIntegration", () => {
  let cwd: string;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
  });

  test("detects .opencode and materializes skill under .opencode/skills", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-opencode-"));
    mkdirSync(join(cwd, ".opencode"), { recursive: true });
    const src = join(cwd, "src-skill", "SKILL.md");
    mkdirSync(join(cwd, "src-skill"), { recursive: true });
    writeFileSync(src, "---\nname: hello\n---\n# Hello\n", "utf8");

    const target = createOpencodeIntegration();
    expect(target.id).toBe("opencode");
    expect(target.deployRoots).toEqual(expect.arrayContaining([".opencode", "."]));
    expect(target.detect({ cwd })).toBe(true);

    await target.materialize([{ name: "hello", type: "skill", source: "local", path: src }], {
      cwd,
      targetId: "opencode",
      deployRoots: target.deployRoots,
    });

    const dest = join(cwd, ".opencode", "skills", "hello", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Hello/);
    expect(existsSync(join(cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(false);
  });

  test("detects opencode.json and opencode.jsonc", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-opencode-detect-"));
    const target = createOpencodeIntegration();
    expect(target.detect({ cwd })).toBe(false);
    writeFileSync(join(cwd, "opencode.json"), "{}\n", "utf8");
    expect(target.detect({ cwd })).toBe(true);
  });

  test("agent materializes without writing opencode.json", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-opencode-agent-"));
    mkdirSync(join(cwd, ".opencode"), { recursive: true });
    const src = join(cwd, "agent.md");
    writeFileSync(src, "---\nname: scout\n---\n# Scout\n", "utf8");
    const target = createOpencodeIntegration();
    await target.materialize([{ name: "scout", type: "agent", source: "local", path: src }], {
      cwd,
      targetId: "opencode",
      deployRoots: target.deployRoots,
    });
    expect(existsSync(join(cwd, ".opencode", "agents", "scout.md"))).toBe(true);
    expect(existsSync(join(cwd, "opencode.json"))).toBe(false);
  });
});
