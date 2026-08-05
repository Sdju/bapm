/**
 * Export module unit coverage: purl/scrub, formats, determinism, carry-forward bags (via serialize).
 */
import { describe, expect, test } from "vite-plus/test";
import {
  buildPurl,
  exportSbom,
  scrubUrl,
  serializeLockfile,
} from "@bapm/core";

describe("Export purl / scrub", () => {
  test("scrubUrl drops userinfo and query", () => {
    expect(scrubUrl("https://user:token@github.com/example/one.git?token=secret")).toBe(
      "https://github.com/example/one.git",
    );
  });

  test("buildPurl github forge with commit", () => {
    expect(
      buildPurl({
        name: "one",
        repo_url: "github.com/example/one",
        resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    ).toBe("pkg:github/example/one@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });

  test("buildPurl local generic without hash", () => {
    expect(
      buildPurl({
        name: "leaf",
        repo_url: "local:./leaf",
        source: "local",
        version: "0.0.1",
      }),
    ).toBe("pkg:generic/leaf");
  });
});

describe("Export SBOM smoke", () => {
  const document = {
    lockfile_version: "1" as const,
    generated_at: "2024-06-01T12:00:00Z",
    dependencies: [
      {
        name: "example-one",
        repo_url: "github.com/example/one",
        resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        resolved_url: "https://user:token@github.com/example/one.git?token=secret",
      },
    ],
  };

  test("cyclonedx and spdx smoke", async () => {
    const cdx = await exportSbom({
      document,
      format: "cyclonedx",
      timestamp: "2020-01-01T00:00:00Z",
    });
    expect(cdx.ok).toBe(true);
    if (!cdx.ok) return;
    const cdxDoc = JSON.parse(cdx.json) as { bomFormat: string; specVersion: string };
    expect(cdxDoc.bomFormat).toBe("CycloneDX");
    expect(cdxDoc.specVersion).toBe("1.5");

    const spdx = await exportSbom({
      document,
      format: "spdx",
      timestamp: "2020-01-01T00:00:00Z",
    });
    expect(spdx.ok).toBe(true);
    if (!spdx.ok) return;
    expect(JSON.parse(spdx.json).spdxVersion).toBe("SPDX-2.3");
  });

  test("pinned timestamp is byte-identical", async () => {
    const a = await exportSbom({
      document,
      timestamp: "2019-05-05T05:05:05Z",
    });
    const b = await exportSbom({
      document,
      timestamp: "2019-05-05T05:05:05Z",
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.json).toBe(b.json);
  });
});

describe("Lock serialize carry bags", () => {
  test("serialize emits mcp_servers when present", () => {
    const yaml = serializeLockfile({
      lockfile_version: "1",
      dependencies: [],
      mcp_servers: { demo: { command: "echo" } },
    });
    expect(yaml).toMatch(/mcp_servers/);
    expect(yaml).toMatch(/demo/);
  });
});
