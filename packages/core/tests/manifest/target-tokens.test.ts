/**
 * mf-005 target tokens: published host ids, legacy aliases, canonicalisation.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  declaredTargetIds,
  ManifestError,
  parseManifest,
  parseManifestDocument,
  serializeManifest,
  writeProducerManifest,
  type BapmManifest,
} from "@b-apm/core";

const PUBLISHED_HOST_IDS = [
  "copilot",
  "claude",
  "cursor",
  "codex",
  "gemini",
  "antigravity",
  "opencode",
  "windsurf",
  "kiro",
  "grok-bot",
  "grok-build",
  "agent-skills",
] as const;

function base(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { name: "target-tokens", version: "0.0.1", ...overrides };
}

function parse(overrides: Record<string, unknown> = {}): BapmManifest {
  return parseManifest(base(overrides));
}

function reject(overrides: Record<string, unknown>): ManifestError {
  try {
    parse(overrides);
  } catch (error) {
    expect(error).toBeInstanceOf(ManifestError);
    return error as ManifestError;
  }
  throw new Error("expected reject");
}

describe("published host ids are valid manifest tokens", () => {
  test.each(PUBLISHED_HOST_IDS)("target: %s parses", (id) => {
    expect(parse({ target: id }).target).toBe(id);
  });

  test.each(PUBLISHED_HOST_IDS)("targets: [%s] parses", (id) => {
    expect(parse({ targets: [id] }).targets).toEqual([id]);
  });

  test.each(PUBLISHED_HOST_IDS)("active: { target: %s } resolves", (id) => {
    expect(parse({ active: { target: id } }).active).toEqual([
      { kind: "target", id, negate: false },
    ]);
  });

  test.each(["kiro", "grok-bot", "grok-build"] as const)("%s object-map key is retained", (id) => {
    const spec = `@b-apm/integration-${id}`;
    const doc = parse({ targets: { [id]: spec } });
    expect(doc.targets).toEqual({ [id]: spec });
    expect(declaredTargetIds(doc)).toEqual([id]);
  });
});

describe("legacy aliases normalise to copilot at parse", () => {
  test.each(["vscode", "agents"] as const)("target: %s → copilot", (alias) => {
    expect(parse({ target: alias }).target).toBe("copilot");
  });

  test.each(["vscode", "agents"] as const)("targets: [%s] → [copilot]", (alias) => {
    expect(parse({ targets: [alias] }).targets).toEqual(["copilot"]);
  });

  test("targets array dedupes alias/canonical collision (first-seen order)", () => {
    expect(parse({ targets: ["vscode", "cursor", "copilot", "agents"] }).targets).toEqual([
      "copilot",
      "cursor",
    ]);
  });

  test.each(["vscode", "agents"] as const)("targets object-map key %s → copilot", (alias) => {
    const doc = parse({ targets: { [alias]: "@b-apm/integration-copilot" } });
    expect(doc.targets).toEqual({ copilot: "@b-apm/integration-copilot" });
    expect(declaredTargetIds(doc)).toEqual(["copilot"]);
  });

  test.each(["vscode", "agents"] as const)("active: { target: %s } → copilot", (alias) => {
    expect(parse({ active: { target: alias } }).active).toEqual([
      { kind: "target", id: "copilot", negate: false },
    ]);
  });

  test("active list-of-maps aliases normalise, including negation", () => {
    expect(parse({ active: [{ target: "vscode" }, { target: "!agents" }] }).active).toEqual([
      { kind: "target", id: "copilot", negate: false },
      { kind: "target", id: "copilot", negate: true },
    ]);
  });

  test("nested preset active aliases normalise", () => {
    const doc = parse({
      active: { preset: "dev" },
      presets: [{ name: "dev", active: { target: "vscode" } }],
    });
    expect(doc.presets?.[0]?.active).toEqual([{ kind: "target", id: "copilot", negate: false }]);
  });

  test("dependency targets subset aliases normalise", () => {
    const doc = parse({
      dependencies: {
        apm: [{ git: "https://github.com/acme/toolkit.git", targets: ["vscode"] }],
      },
    });
    const entry = (doc.dependencies?.apm?.[0] ?? {}) as Record<string, unknown>;
    expect(entry.targets).toEqual(["copilot"]);
  });

  test("alias collision in an object map fails closed", () => {
    const err = reject({
      targets: {
        vscode: "@b-apm/integration-copilot",
        copilot: "@acme/other-copilot",
      },
    });
    expect(err.message).toMatch(/duplicate host "copilot"/i);
    expect(err.message).toMatch(/vscode/);
  });
});

describe("fail-closed and vendor behaviour are unchanged", () => {
  test.each(["not-a-host", "KIRO", "grok_build", "x-acme"] as const)(
    "invalid token %s is still rejected",
    (token) => {
      const err = reject({ target: token });
      expect(err.message).toMatch(/Invalid target token/);
      expect(err.message).toContain(token);
    },
  );

  test("invalid active target is still rejected", () => {
    expect(() => parse({ active: { target: "not-a-host" } })).toThrow(/not-a-host/);
  });

  test("vendor x-<vendor>-<name> tokens are preserved (not alias-mapped)", () => {
    const doc = parse({ targets: { "x-acme-editor": "@acme/integration-editor" } });
    expect(doc.targets).toEqual({ "x-acme-editor": "@acme/integration-editor" });
    expect(parse({ active: { target: "x-acme-editor" } }).active?.[0]?.id).toBe("x-acme-editor");
  });
});

describe("write path emits canonical ids", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("producer write normalises aliases in target, targets, active and map keys", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-target-tokens-write-"));
    const dest = join(cwd, "bapm.yml");
    const { path, warnings } = writeProducerManifest(
      {
        name: "write-aliases",
        version: "0.0.1",
        targets: { vscode: "@b-apm/integration-copilot" },
        active: { target: ["agents"] },
      },
      { cwd, path: dest },
    );
    expect(warnings).toEqual([]);
    const text = readFileSync(path, "utf8");
    expect(text).toMatch(/targets:[\s\S]*copilot:/);
    expect(text).not.toMatch(/vscode|agents:/);

    const reloaded = parseManifest(
      parseManifestDocument({
        name: "reload",
        version: "0.0.1",
        target: "vscode",
      }).document,
    );
    expect(reloaded.target).toBe("copilot");
  });

  test("serialize of a parsed document emits canonical active ids", () => {
    const doc = parse({ target: "vscode", active: { target: "agents" } });
    const yaml = serializeManifest(doc);
    expect(yaml).toMatch(/^target: copilot$/m);
    expect(yaml).toMatch(/active:[\s\S]*- target: copilot/);
    expect(yaml).not.toMatch(/vscode|agents:/);
  });
});
