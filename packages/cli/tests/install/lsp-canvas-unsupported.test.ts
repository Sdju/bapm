/**
 * CLI install must print LSP_UNSUPPORTED / CANVAS_UNSUPPORTED warnings.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  linkCursorIntegration,
  runInProject,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("CLI install LSP/canvas warnings", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("root and dependency LSP/canvas warnings reach stderr", async () => {
    project = createTempProject();
    linkCursorIntegration(project.cwd);
    writeText(
      project.cwd,
      "bapm.yml",
      [
        "name: lsp-canvas-cli-root",
        "version: 0.0.1",
        "active:",
        "  target: cursor",
        "canvas:",
        "  theme: dark",
        "dependencies:",
        "  apm:",
        "    - path: ./leaf",
        "  lsp:",
        "    - name: typescript-language-server",
        "      command: typescript-language-server",
        "",
      ].join("\n"),
    );
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeText(
      project.cwd,
      "leaf/bapm.yml",
      [
        "name: lsp-canvas-cli-leaf",
        "version: 0.0.1",
        "canvas:",
        "  panels: []",
        "dependencies:",
        "  apm: []",
        "  lsp:",
        "    - name: yaml-language-server",
        "      command: yaml-language-server",
        "",
      ].join("\n"),
    );

    const { result, stderr } = await runInProject(project.cwd, [
      "install",
      "--no-frozen",
      "--no-policy",
    ]);

    expect(result).toBe(0);
    const text = stderr.join("\n");
    expect(text.match(/LSP_UNSUPPORTED/g)).toHaveLength(2);
    expect(text).toMatch(/lsp-canvas-cli-root/);
    expect(text).toMatch(/lsp-canvas-cli-leaf/);
    expect(text).toMatch(/typescript-language-server/);
    expect(text).toMatch(/yaml-language-server/);
    expect(text.match(/CANVAS_UNSUPPORTED/g)).toHaveLength(2);
  });

  test("normal install prints no LSP/canvas warnings", async () => {
    project = createTempProject();
    linkCursorIntegration(project.cwd);
    writeText(
      project.cwd,
      "bapm.yml",
      [
        "name: plain-cli-root",
        "version: 0.0.1",
        "active:",
        "  target: cursor",
        "dependencies:",
        "  apm:",
        "    - path: ./leaf",
        "",
      ].join("\n"),
    );
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeText(
      project.cwd,
      "leaf/bapm.yml",
      ["name: plain-cli-leaf", "version: 0.0.1", "dependencies:", "  apm: []", ""].join("\n"),
    );

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "install",
      "--no-frozen",
      "--no-policy",
    ]);

    expect(result).toBe(0);
    expect(combined).not.toMatch(/LSP_UNSUPPORTED|CANVAS_UNSUPPORTED/);
    expect(stderr.join("\n")).not.toMatch(/LSP_UNSUPPORTED|CANVAS_UNSUPPORTED/);
  });
});
