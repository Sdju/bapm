/**
 * Acceptance (RED): structured `active` parse/validate + dual-read.
 * OpenSpec change: manifest-presets
 * Specs: manifest-yaml-validate, manifest-presets
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  activeEntriesOf,
  createTempProject,
  expectParseReject,
  getLoadManifest,
  join,
  parseOk,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("manifest-presets parse — structured active accepted", () => {
  test("list-of-maps active with preset + target retained", () => {
    const doc = parseOk({
      presets: [{ name: "developer", dependencies: { apm: [] } }],
      active: [{ preset: "developer" }, { target: "cursor" }],
    });

    const entries = activeEntriesOf(doc);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "preset", id: "developer", negate: false }),
        expect.objectContaining({ kind: "target", id: "cursor", negate: false }),
      ]),
    );
    expect(entries).toHaveLength(2);
  });

  test("object-form active with preset array + target scalar retained", () => {
    const doc = parseOk({
      presets: [
        { name: "developer", dependencies: { apm: [] } },
        { name: "analyst", dependencies: { apm: [] } },
      ],
      active: { preset: ["developer", "analyst"], target: "cursor" },
    });

    const entries = activeEntriesOf(doc);
    expect(entries.map((e) => `${e.kind}:${e.id}`)).toEqual([
      "preset:developer",
      "preset:analyst",
      "target:cursor",
    ]);
  });

  test("negation entries accepted at parse (!preset / !target)", () => {
    const doc = parseOk({
      presets: [{ name: "developer", dependencies: { apm: [] } }],
      active: [{ preset: "!developer" }, { target: "!cursor" }],
    });

    const entries = activeEntriesOf(doc);
    expect(entries).toEqual([
      expect.objectContaining({ kind: "preset", id: "developer", negate: true }),
      expect.objectContaining({ kind: "target", id: "cursor", negate: true }),
    ]);
  });

  test("object-form active with target array accepted", () => {
    const doc = parseOk({
      active: { target: ["cursor", "x-acme-editor"] },
    });
    const entries = activeEntriesOf(doc);
    expect(entries).toEqual([
      expect.objectContaining({ kind: "target", id: "cursor", negate: false }),
      expect.objectContaining({ kind: "target", id: "x-acme-editor", negate: false }),
    ]);
  });
});

describe("manifest-presets parse — structured active rejected", () => {
  test("legacy bare host-token list rejected fail-closed", () => {
    const { message } = expectParseReject({ active: ["cursor"] });
    expect(message).toMatch(/active/i);
    expect(message).toMatch(/legacy|bare|structured|preset|target|map|object|sequence of/i);
  });

  test("empty active array rejected", () => {
    const { message } = expectParseReject({ active: [] });
    expect(message).toMatch(/active/i);
    expect(message).toMatch(/empty|non-empty/i);
  });

  test("empty active object rejected", () => {
    const { message } = expectParseReject({ active: {} });
    expect(message).toMatch(/active/i);
    expect(message).toMatch(/empty|non-empty|preset|target/i);
  });

  test("invalid target token rejected with named diagnostic", () => {
    const { message, path, details } = expectParseReject({
      active: { target: "not-a-host" },
    });
    expect(message).toMatch(/not-a-host/);
    expect(message).toMatch(/mf-005|target|token|invalid|active/i);
    const named =
      path?.includes("not-a-host") ||
      details?.token === "not-a-host" ||
      /active|not-a-host/.test(String(path ?? message));
    expect(named).toBe(true);
  });

  test("scalar active rejected", () => {
    const { message } = expectParseReject({ active: "cursor" });
    expect(message).toMatch(/active/i);
  });
});

describe("manifest-presets parse — dual-read apm.yml", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("apm.yml structured active with target loads under same rules", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "apm.yml"),
      [
        "name: dual-active",
        "version: 0.0.1",
        "active:",
        "  target: cursor",
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
    );

    const loaded = getLoadManifest()({ cwd: project.cwd });
    expect(loaded.sourceFilename).toMatch(/apm\.yml/);
    const entries = activeEntriesOf(loaded.document);
    expect(entries).toEqual([
      expect.objectContaining({ kind: "target", id: "cursor", negate: false }),
    ]);
  });

  test("apm.yml legacy bare active list rejected", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "apm.yml"),
      [
        "name: dual-legacy-active",
        "version: 0.0.1",
        "active:",
        "  - cursor",
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
    );

    expect(() => getLoadManifest()({ cwd: project!.cwd })).toThrow(/active/i);
  });
});
