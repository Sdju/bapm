/**
 * `dependencies.lsp` and canvas declarations are parsed but not deployable.
 * Install surfaces explicit warnings and never silently drops them.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { createIntegrationRegistry } from "@b-apm/integration-api";
import { detectUnsupportedDeclarations, runInstall } from "../../src/index.ts";

type Project = { cwd: string; cleanup: () => void };

type ProjectOptions = {
  rootLsp?: boolean;
  depLsp?: boolean;
  rootCanvas?: boolean;
  depCanvas?: boolean;
};

function createProject(options: ProjectOptions = {}): Project {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-lsp-canvas-"));
  writeFileSync(
    join(cwd, "bapm.yml"),
    [
      "name: lsp-canvas-root",
      "version: 0.0.1",
      "active:",
      "  target: cursor",
      ...(options.rootCanvas ? ["canvas:", "  theme: dark"] : []),
      ...(options.rootLsp
        ? [
            "dependencies:",
            "  apm:",
            "    - path: ./leaf",
            "  lsp:",
            "    - name: typescript-language-server",
            "      command: typescript-language-server",
            "    - pyright",
          ]
        : ["dependencies:", "  apm:", "    - path: ./leaf"]),
      "",
    ].join("\n"),
    "utf8",
  );
  mkdirSync(join(cwd, "leaf"), { recursive: true });
  writeFileSync(
    join(cwd, "leaf", "bapm.yml"),
    [
      "name: lsp-canvas-leaf",
      "version: 0.0.1",
      ...(options.depCanvas ? ["canvas:", "  panels: []"] : []),
      "dependencies:",
      "  apm: []",
      ...(options.depLsp
        ? ["  lsp:", "    - name: yaml-language-server", "      command: yaml-language-server"]
        : []),
      "",
    ].join("\n"),
    "utf8",
  );
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

function registry() {
  const integrationRegistry = createIntegrationRegistry();
  integrationRegistry.register({
    id: "cursor",
    deployRoots: [".cursor"],
    detect: () => false,
    materialize: async () => ({ targetId: "cursor", deployedFiles: [] }),
  });
  return integrationRegistry;
}

function diagnosticsOf(
  result: { diagnostics: unknown[] },
  code: "LSP_UNSUPPORTED" | "CANVAS_UNSUPPORTED",
): Array<Record<string, unknown>> {
  return result.diagnostics.filter(
    (item) => item && typeof item === "object" && (item as Record<string, unknown>).code === code,
  ) as Array<Record<string, unknown>>;
}

describe("install LSP/canvas diagnostics", () => {
  let project: Project | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("root dependencies.lsp warns and names the declared servers", async () => {
    project = createProject({ rootLsp: true });
    const result = await runInstall({
      cwd: project.cwd,
      integrationRegistry: registry(),
      noPolicy: true,
    });

    const warnings = diagnosticsOf(result, "LSP_UNSUPPORTED");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.packageName).toBe("lsp-canvas-root");
    expect(warnings[0]!.servers).toEqual(["typescript-language-server", "pyright"]);
    expect(warnings[0]!.warn).toBe(true);
    expect(warnings[0]!.deploy).toBe(false);
    expect(String(warnings[0]!.message)).toContain("LSP_UNSUPPORTED");
    expect(String(warnings[0]!.message)).toContain("typescript-language-server");
  });

  test("dependency dependencies.lsp warns with the dependency package name", async () => {
    project = createProject({ depLsp: true });
    const result = await runInstall({
      cwd: project.cwd,
      integrationRegistry: registry(),
      noPolicy: true,
    });

    const warnings = diagnosticsOf(result, "LSP_UNSUPPORTED");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.packageName).toBe("lsp-canvas-leaf");
    expect(warnings[0]!.servers).toEqual(["yaml-language-server"]);
  });

  test("root and dependency canvas keys warn without entering trust gates", async () => {
    project = createProject({ rootCanvas: true, depCanvas: true });
    const result = await runInstall({
      cwd: project.cwd,
      integrationRegistry: registry(),
      noPolicy: true,
    });

    const warnings = diagnosticsOf(result, "CANVAS_UNSUPPORTED");
    expect(warnings.map((warning) => warning.packageName).sort()).toEqual([
      "lsp-canvas-leaf",
      "lsp-canvas-root",
    ]);
    for (const warning of warnings) {
      expect(warning.source).toBe("manifest");
      expect(warning.warn).toBe(true);
      expect(warning.deploy).toBe(false);
      expect(String(warning.message)).toContain("CANVAS_UNSUPPORTED");
    }
  });

  test("canvas primitive type is reported instead of silently dropped", () => {
    const diagnostics = detectUnsupportedDeclarations({
      rootManifest: { name: "local-root", version: "0.0.1" },
      primitives: [
        {
          name: "dashboard",
          type: "canvas",
          source: "dependency:canvas-pkg",
          path: "/tmp/canvas-pkg/.apm/canvas/dashboard.yml",
        },
      ],
    });

    const warnings = diagnostics.filter((item) => item.code === "CANVAS_UNSUPPORTED");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.source).toBe("primitive");
    expect(warnings[0]!.primitive).toBe("dashboard");
    expect(warnings[0]!.packageName).toBe("canvas-pkg");
    expect(warnings[0]!.deploy).toBe(false);
  });

  test("normal install without LSP or canvas is unaffected", async () => {
    project = createProject();
    const result = await runInstall({
      cwd: project.cwd,
      integrationRegistry: registry(),
      noPolicy: true,
    });

    expect(result.ok).toBe(true);
    expect(diagnosticsOf(result, "LSP_UNSUPPORTED")).toEqual([]);
    expect(diagnosticsOf(result, "CANVAS_UNSUPPORTED")).toEqual([]);
  });
});
