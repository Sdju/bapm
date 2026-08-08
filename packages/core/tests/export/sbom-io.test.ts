/**
 * Export SBOM IO: CycloneDX 1.5 / SPDX 2.3 inventory from lock fields.
 */
import { asText } from "../asText.ts";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  createTempProject,
  getExportSbom,
  isExportFailure,
  sampleLockDocument,
  sbomText,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("core exportSbom", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
    delete process.env.SOURCE_DATE_EPOCH;
  });

  test("default format is CycloneDX 1.5 JSON from lock fields only", async () => {
    const exportSbom = getExportSbom();
    const out = sbomText(
      await exportSbom({
        document: sampleLockDocument(),
        timestamp: "2020-01-01T00:00:00Z",
      }),
    );
    const doc = JSON.parse(out) as Record<string, unknown>;
    expect(doc.bomFormat === "CycloneDX").toBe(true);
    expect(asText(doc.specVersion)).toBe("1.5");
    expect(Array.isArray(doc.components)).toBe(true);
    const components = doc.components as Array<Record<string, unknown>>;
    // Synthetic local-self omitted; real deps present with purl
    expect(components.some((c) => asText(c.purl ?? "").includes("pkg:"))).toBe(true);
  });

  test("format spdx emits SPDX-2.3 JSON", async () => {
    const exportSbom = getExportSbom();
    const out = sbomText(
      await exportSbom({
        document: sampleLockDocument(),
        format: "spdx",
        timestamp: "2020-01-01T00:00:00Z",
      }),
    );
    const doc = JSON.parse(out) as Record<string, unknown>;
    const spdxVersion = asText(doc.spdxVersion ?? doc.SPDXVersion ?? "");
    expect(spdxVersion).toMatch(/SPDX-2\.3/i);
  });

  test("unknown format fails closed (no successful SBOM body)", async () => {
    const exportSbom = getExportSbom();
    let threw = false;
    let result: unknown;
    try {
      result = await exportSbom({
        document: sampleLockDocument(),
        format: "not-a-format",
        timestamp: "2020-01-01T00:00:00Z",
      });
    } catch {
      threw = true;
    }
    if (!threw) {
      expect(isExportFailure(result)).toBe(true);
      expect(() => sbomText(result)).toThrow();
    }
  });

  test("same lock + pinned timestamp → byte-identical exports", async () => {
    const exportSbom = getExportSbom();
    const opts = {
      document: sampleLockDocument(),
      format: "cyclonedx",
      timestamp: "2019-05-05T05:05:05Z",
    };
    const a = sbomText(await exportSbom(opts));
    const b = sbomText(await exportSbom(opts));
    expect(a).toBe(b);
  });

  test("explicit timestamp wins over SOURCE_DATE_EPOCH and generated_at", async () => {
    process.env.SOURCE_DATE_EPOCH = "1577836800"; // 2020-01-01
    const exportSbom = getExportSbom();
    const out = sbomText(
      await exportSbom({
        document: sampleLockDocument({ generated_at: "2024-06-01T12:00:00Z" }),
        timestamp: "2018-03-03T03:03:03Z",
      }),
    );
    expect(out).toMatch(/2018-03-03T03:03:03Z/);
    expect(out).not.toMatch(/2024-06-01T12:00:00Z/);
  });

  test("SOURCE_DATE_EPOCH used when no explicit timestamp", async () => {
    process.env.SOURCE_DATE_EPOCH = "1609459200"; // 2021-01-01T00:00:00Z
    const exportSbom = getExportSbom();
    const out = sbomText(
      await exportSbom({
        document: sampleLockDocument({ generated_at: "2024-06-01T12:00:00Z" }),
      }),
    );
    expect(out).toMatch(/2021-01-01T00:00:00Z/);
  });

  test("github-style repo gets forge purl with commit", async () => {
    const exportSbom = getExportSbom();
    const out = sbomText(
      await exportSbom({
        document: sampleLockDocument(),
        timestamp: "2020-01-01T00:00:00Z",
      }),
    );
    expect(out).toMatch(/pkg:github\/example\/one@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/);
  });

  test("distribution URL scrub drops userinfo and query", async () => {
    const exportSbom = getExportSbom();
    const out = sbomText(
      await exportSbom({
        document: sampleLockDocument(),
        timestamp: "2020-01-01T00:00:00Z",
      }),
    );
    expect(out).not.toMatch(/user:token/);
    expect(out).not.toMatch(/token=secret/);
  });

  test("undeclared license omitted in CycloneDX; NOASSERTION in SPDX", async () => {
    const exportSbom = getExportSbom();
    const cdx = JSON.parse(
      sbomText(
        await exportSbom({
          document: sampleLockDocument(),
          format: "cyclonedx",
          timestamp: "2020-01-01T00:00:00Z",
        }),
      ),
    ) as { components: Array<Record<string, unknown>> };
    for (const c of cdx.components ?? []) {
      expect(c).not.toHaveProperty("licenses");
    }

    const spdx = JSON.parse(
      sbomText(
        await exportSbom({
          document: sampleLockDocument(),
          format: "spdx",
          timestamp: "2020-01-01T00:00:00Z",
        }),
      ),
    ) as { packages?: Array<Record<string, unknown>> };
    const pkgs = spdx.packages ?? [];
    expect(pkgs.length).toBeGreaterThan(0);
    for (const p of pkgs) {
      const license = asText(p.licenseDeclared ?? p.licenseConcluded ?? "");
      expect(license).toMatch(/NOASSERTION/i);
    }
  });

  test("missing lock from cwd fails closed", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
      `name: no-lock\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    const exportSbom = getExportSbom();
    let threw = false;
    let result: unknown;
    try {
      result = await exportSbom({ cwd: project.cwd });
    } catch {
      threw = true;
    }
    if (!threw) {
      expect(isExportFailure(result)).toBe(true);
    }
  });
});
