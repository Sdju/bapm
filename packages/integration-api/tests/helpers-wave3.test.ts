import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import {
  detectAnyPath,
  mergeLspServers,
  primitivePackageKey,
  resolveIntegrationCapabilities,
  safeHookSlug,
  skillsOnlyHandlers,
} from "../src/index.ts";
import type {
  AttributedPrimitive,
  BapmIntegration,
  PrimitiveMaterializeHandlers,
} from "../src/index.ts";

function prim(
  partial: Partial<AttributedPrimitive> & Pick<AttributedPrimitive, "name" | "type">,
): AttributedPrimitive {
  return { ...partial, source: partial.source ?? "local" } as AttributedPrimitive;
}

describe("mergeLspServers", () => {
  test("updates managed servers and keeps foreign entries", () => {
    const result = mergeLspServers({
      document: {
        lspServers: { foreign: { command: "keep" }, managed: { command: "old" } },
        meta: 1,
      },
      incoming: { managed: { command: "new" } },
      managedServers: ["managed"],
    });
    expect(result.document).toEqual({
      lspServers: { foreign: { command: "keep" }, managed: { command: "new" } },
      meta: 1,
    });
    expect(result.servers).toEqual(["managed"]);
  });

  test("refuses to overwrite a foreign server with different content", () => {
    expect(() =>
      mergeLspServers({
        document: { lspServers: { foreign: { command: "keep" } } },
        incoming: { foreign: { command: "other" } },
        ownershipLabel: "HOST_LSP_OWNERSHIP",
        pathLabel: ".host/lsp.json",
      }),
    ).toThrow(/HOST_LSP_OWNERSHIP: LSP server 'foreign' already exists/);
  });

  test("allows identical foreign content", () => {
    expect(() =>
      mergeLspServers({
        document: { lspServers: { foreign: { command: "same" } } },
        incoming: { foreign: { command: "same" } },
      }),
    ).not.toThrow();
  });
});

describe("naming helpers", () => {
  test("primitivePackageKey prefers packageName then dependency source", () => {
    expect(primitivePackageKey(prim({ name: "a", type: "skill", packageName: "@scope/pkg" }))).toBe(
      "@scope-pkg",
    );
    expect(primitivePackageKey(prim({ name: "a", type: "skill", source: "dependency:pkg" }))).toBe(
      "pkg",
    );
    expect(primitivePackageKey(prim({ name: "a", type: "skill" }))).toBe("local");
  });

  test("safeHookSlug normalizes and falls back", () => {
    expect(safeHookSlug("My Hook!")).toBe("my-hook");
    expect(safeHookSlug("!!!")).toBe("hook");
  });
});

describe("capabilities and detection", () => {
  const base: BapmIntegration = {
    id: "test",
    deployRoots: [],
    detect: () => false,
    materialize: () => undefined,
  };

  test("resolves contract defaults", () => {
    expect(resolveIntegrationCapabilities(base)).toEqual({
      mcpEnvMode: "bake",
      mcpHeadersEnvMode: "bake",
      mcpScope: "project",
      supportsGlobalMcp: false,
      supportsGlobalFiles: false,
    });
  });

  test("inherits header mode from env mode", () => {
    expect(
      resolveIntegrationCapabilities({ ...base, mcpEnvMode: "translate" }).mcpHeadersEnvMode,
    ).toBe("translate");
  });

  test("detectAnyPath checks dirs and files", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-detect-"));
    mkdirSync(join(cwd, ".host"));
    writeFileSync(join(cwd, "host.json"), "{}");
    expect(detectAnyPath(cwd, { dirs: [".host"] })).toBe(true);
    expect(detectAnyPath(cwd, { files: ["host.json"] })).toBe(true);
    expect(detectAnyPath(cwd, { dirs: ["missing"] })).toBe(false);
  });
});

describe("skillsOnlyHandlers", () => {
  test("deploys skills and diagnoses other kinds", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-skills-only-"));
    const deployedFiles: Array<{ path: string }> = [];
    const diagnostics: Array<{ code: string; message: string }> = [];
    const handlers: PrimitiveMaterializeHandlers = skillsOnlyHandlers({
      cwd,
      deployRoots: [".agents"],
      destDir: ".agents/skills",
      code: "HOST_PRIMITIVE_UNSUPPORTED",
      label: "host",
      deployedFiles,
      diagnostics,
    });
    await handlers.skill!(prim({ name: "hello", type: "skill", content: "# hi" }), {
      name: "hello",
      type: "skill",
    });
    await handlers.instruction!(prim({ name: "rule", type: "instruction" }), {
      name: "rule",
      type: "instruction",
    });
    expect(deployedFiles[0]?.path).toBe(".agents/skills/hello/SKILL.md");
    expect(diagnostics[0]?.code).toBe("HOST_PRIMITIVE_UNSUPPORTED");
  });
});
