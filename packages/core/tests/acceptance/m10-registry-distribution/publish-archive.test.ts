/**
 * M10 MUST: core flat publish archive builder (apm.yml + .apm/ at zip root).
 * Specs: producer-publish. Checklist C §10.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import {
  createTempProject,
  getBuildPublishArchive,
  listZipPaths,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

function resolveArchiveBytes(cwd: string, result: unknown): Uint8Array {
  if (result instanceof Uint8Array) return result;
  if (Buffer.isBuffer(result)) return new Uint8Array(result);
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (r.bytes instanceof Uint8Array) return r.bytes;
    if (Buffer.isBuffer(r.bytes)) return new Uint8Array(r.bytes);
    if (typeof r.archivePath === "string" || typeof r.path === "string") {
      const path = String(r.archivePath ?? r.path);
      return new Uint8Array(readFileSync(path));
    }
  }
  // Common: wrote zip next to cwd
  const candidates = ["publish.zip", "package.zip", "dist/publish.zip"];
  for (const rel of candidates) {
    try {
      return new Uint8Array(readFileSync(join(cwd, rel)));
    } catch {
      /* continue */
    }
  }
  throw new TypeError("buildPublishArchive did not yield zip bytes or path");
}

describe("M10 core flat publish archive", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("flat zip root has apm.yml + .apm/ (not plugin wrapper)", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: contoso/demo\nversion: "1.2.3"\ndependencies:\n  apm: []\n  mcp: []\n`,
    );
    writeText(join(project.cwd, ".apm", "instructions.md"), "# hello\n");

    const result = await getBuildPublishArchive()({
      cwd: project.cwd,
      dryRun: true,
    });
    const bytes = resolveArchiveBytes(project.cwd, result);
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K

    const paths = listZipPaths(bytes);
    expect(paths.some((p) => p === "apm.yml" || p.endsWith("/apm.yml"))).toBe(true);
    expect(paths.some((p) => p === ".apm/instructions.md" || p.endsWith(".apm/instructions.md"))).toBe(
      true,
    );
    // Must not be M7/plugin wrapper layout (no nested package root folder only)
    const entries = unzipSync(bytes);
    expect(entries["apm.yml"] || Object.keys(entries).find((k) => k.endsWith("apm.yml"))).toBeTruthy();
    const apmYmlKey = entries["apm.yml"]
      ? "apm.yml"
      : Object.keys(entries).find((k) => k === "apm.yml" || k.endsWith("/apm.yml"));
    expect(apmYmlKey).toBeTruthy();
    const manifestText = new TextDecoder().decode(entries[apmYmlKey!]);
    expect(manifestText).toMatch(/name:\s*contoso\/demo/);
    expect(manifestText).toMatch(/1\.2\.3/);
  });
});
