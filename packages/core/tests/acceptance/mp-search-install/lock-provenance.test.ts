/**
 * G6 — Lock provenance fields round-trip (discovered_via, marketplace_plugin_name, source_*)
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  asRecord,
  createTempProject,
  getLockApis,
  lockDepsOf,
  writeText,
} from "./helpers.ts";
import { join } from "node:path";

describe("mp-search-install G6 lock provenance round-trip", () => {
  let project: { cwd: string; cleanup: () => void } | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("provenance keys survive load → serialize", () => {
    project = createTempProject();
    const yaml = `lockfile_version: "1"
dependencies:
  - repo_url: https://github.com/acme/tools
    name: tools
    source: git
    resolved_commit: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    discovered_via: acme-mp
    marketplace_plugin_name: tools
    source_url: https://example.com/mp/marketplace.json
    source_digest: sha256:deadbeef
`;
    const lockPath = join(project.cwd, "bapm.lock.yaml");
    writeText(lockPath, yaml);

    const { load, serialize } = getLockApis();
    const loaded = load({ cwd: project.cwd });
    const deps = lockDepsOf(loaded);
    expect(deps).toHaveLength(1);
    expect(deps[0]!.discovered_via).toBe("acme-mp");
    expect(deps[0]!.marketplace_plugin_name).toBe("tools");
    expect(deps[0]!.source_url).toMatch(/example\.com/);
    expect(deps[0]!.source_digest).toMatch(/deadbeef/);

    const out = serialize(asRecord(loaded).document ?? loaded);
    expect(out).toMatch(/discovered_via:\s*acme-mp/);
    expect(out).toMatch(/marketplace_plugin_name:\s*tools/);
    expect(out).toMatch(/source_url:/);
    expect(out).toMatch(/source_digest:/);
  });

  test("absent provenance omitted (no null placeholders)", () => {
    project = createTempProject();
    const yaml = `lockfile_version: "1"
dependencies:
  - repo_url: https://github.com/acme/leaf
    name: leaf
    source: git
    resolved_commit: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
`;
    writeText(join(project.cwd, "bapm.lock.yaml"), yaml);
    const { load, serialize } = getLockApis();
    const loaded = load({ cwd: project.cwd });
    const out = serialize(asRecord(loaded).document ?? loaded);
    expect(out).not.toMatch(/discovered_via:\s*null/);
    expect(out).not.toMatch(/marketplace_plugin_name:\s*null/);
    expect(out).not.toMatch(/source_url:\s*null/);
    expect(out).not.toMatch(/source_digest:\s*null/);
  });
});
