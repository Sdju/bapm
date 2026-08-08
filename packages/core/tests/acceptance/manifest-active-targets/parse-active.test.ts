/**
 * Acceptance (RED): parse/validate top-level `active` (mf-005 list; empty/scalar reject).
 * OpenSpec change: manifest-active-targets
 * Spec: manifest-yaml-validate (active field)
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  createTempProject,
  expectParseReject,
  getLoadManifest,
  parseOk,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("manifest-active-targets parse — accept non-empty active", () => {
  test("non-empty active list accepted and retained", () => {
    const doc = parseOk({
      active: ["cursor", "x-acme-editor"],
    }) as Record<string, unknown>;

    expect(doc.active).toEqual(["cursor", "x-acme-editor"]);
  });

  test("sole active entry accepted", () => {
    const doc = parseOk({ active: ["cursor"] }) as Record<string, unknown>;
    expect(doc.active).toEqual(["cursor"]);
  });
});

describe("manifest-active-targets parse — reject invalid active", () => {
  test("empty active list rejected fail-closed", () => {
    const { message, path } = expectParseReject({ active: [] });
    expect(message).toMatch(/active/i);
    expect(message).toMatch(/empty|non-empty|at least one|\[]/i);
    expect(path === undefined || /active/.test(path)).toBe(true);
  });

  test("invalid active token rejected with named diagnostic", () => {
    const { message, path, details } = expectParseReject({
      active: ["not-a-host"],
    });
    expect(message).toMatch(/not-a-host/);
    expect(message).toMatch(/mf-005|target|token|invalid|active/i);
    const named =
      path?.includes("not-a-host") ||
      details?.token === "not-a-host" ||
      /active\[|active\.|not-a-host/.test(String(path ?? message));
    expect(named).toBe(true);
  });

  test("scalar active rejected", () => {
    const { message } = expectParseReject({ active: "cursor" });
    expect(message).toMatch(/active/i);
    expect(message).toMatch(/array|list|sequence|must be/i);
  });

  test("object-map active rejected", () => {
    const { message } = expectParseReject({
      active: { cursor: true },
    });
    expect(message).toMatch(/active/i);
  });

  test("empty string element rejected", () => {
    const { message } = expectParseReject({ active: ["cursor", ""] });
    expect(message).toMatch(/active|empty|non-empty/i);
  });
});

describe("manifest-active-targets parse — dual-read apm.yml", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("apm.yml with valid active loads under same rules as bapm.yml", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "apm.yml"),
      ["name: dual-active", "version: 0.0.1", "active:", "  - cursor", "dependencies:", "  apm: []", ""].join(
        "\n",
      ),
    );

    const loaded = getLoadManifest()({ cwd: project.cwd });
    expect(loaded.sourceFilename).toMatch(/apm\.yml/);
    expect((loaded.document as Record<string, unknown>).active).toEqual(["cursor"]);
  });

  test("apm.yml with empty active rejected", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "apm.yml"),
      ["name: dual-empty-active", "version: 0.0.1", "active: []", "dependencies:", "  apm: []", ""].join(
        "\n",
      ),
    );

    expect(() => getLoadManifest()({ cwd: project!.cwd })).toThrow(/active/i);
  });
});
