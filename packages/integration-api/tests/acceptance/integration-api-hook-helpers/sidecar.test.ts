/**
 * HookOwnershipSidecar read/write contract
 * (integration-api-hook-helpers acceptance).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { api, tempCwd, writeText, type HookOwnershipSidecar } from "./helpers.ts";

const { readHookOwnershipSidecar, writeHookOwnershipSidecar } = api;

describe("readHookOwnershipSidecar / writeHookOwnershipSidecar", () => {
  test("missing sidecar reads as empty owned", () => {
    const cwd = tempCwd("bapm-hook-sidecar-missing-");
    const path = join(cwd, ".cursor", "bapm-hooks.json");
    expect(existsSync(path)).toBe(false);
    expect(readHookOwnershipSidecar(path)).toEqual({ owned: {} });
  });

  test("malformed sidecar reads as empty owned without throwing", () => {
    const cwd = tempCwd("bapm-hook-sidecar-bad-");
    const path = join(cwd, ".cursor", "bapm-hooks.json");
    writeText(path, "{not-json");
    expect(readHookOwnershipSidecar(path)).toEqual({ owned: {} });

    writeText(path, JSON.stringify({ owned: "nope" }));
    expect(readHookOwnershipSidecar(path)).toEqual({ owned: {} });

    writeText(path, JSON.stringify({ something: 1 }));
    expect(readHookOwnershipSidecar(path)).toEqual({ owned: {} });
  });

  test("write round-trips owned records with mixed optional fields", () => {
    const cwd = tempCwd("bapm-hook-sidecar-roundtrip-");
    const path = join(cwd, ".cursor", "bapm-hooks.json");
    const doc: HookOwnershipSidecar = {
      owned: {
        "pkg/a": {
          packageName: "pkg",
          entries: [{ event: "SessionStart", command: "./.cursor/hooks/a/run.sh" }],
          scripts: [".cursor/hooks/a/run.sh"],
        },
        "pkg/b": {
          packageName: "pkg",
          hookFile: ".github/hooks/pkg-b.json",
          scripts: [".github/hooks/scripts/pkg/b.sh"],
        },
        "pkg/c": {
          packageName: "pkg",
          hookFiles: [".kiro/hooks/c.kiro.hook"],
          scripts: [".kiro/hooks/scripts/c.sh"],
        },
      },
    };

    writeHookOwnershipSidecar(path, doc);

    const raw = readFileSync(path, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toBe(`${JSON.stringify({ owned: doc.owned }, null, 2)}\n`);

    const roundTrip = readHookOwnershipSidecar(path);
    expect(roundTrip.owned["pkg/a"]?.entries).toEqual(doc.owned["pkg/a"]?.entries);
    expect(roundTrip.owned["pkg/a"]?.scripts).toEqual(doc.owned["pkg/a"]?.scripts);
    expect(roundTrip.owned["pkg/b"]?.hookFile).toBe(".github/hooks/pkg-b.json");
    expect(roundTrip.owned["pkg/b"]?.scripts).toEqual(doc.owned["pkg/b"]?.scripts);
    expect(roundTrip.owned["pkg/c"]?.hookFiles).toEqual(doc.owned["pkg/c"]?.hookFiles);
    expect(roundTrip.owned["pkg/c"]?.scripts).toEqual(doc.owned["pkg/c"]?.scripts);
  });
});
