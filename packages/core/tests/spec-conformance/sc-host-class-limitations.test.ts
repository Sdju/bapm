/**
 * Limitations honesty after sc-host-class claim flip (promoted):
 * claimed §10.3 host-class floor acknowledged; soft zip + residual Auth depth named;
 * must NOT frame full host-class scoping as wholly deferred.
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import {
  conformanceJsonPath,
  conformanceMdPath,
  limitationsBlob,
  loadChecklist,
  readText,
  scopeOutBlob,
} from "./sc-claims-helpers.ts";

describe("sc-host-class Limitations honesty", () => {
  test("checklist Limitations acknowledge claimed §10.3 host-class floor", () => {
    const doc = loadChecklist();
    const blob = `${limitationsBlob(doc)}\n${scopeOutBlob(doc)}`;

    // Pre-claim framing must leave Limitations after the flip.
    expect(
      /Residual OpenAPM §10 security-depth gaps remain skipped/i.test(blob) ||
        /thin marketplace env host unlock[\s\S]{0,160}not full OpenAPM §10\.3/i.test(blob) ||
        /^[-*]\s*host-class AuthResolver\s*$/im.test(blob),
      `Limitations must not keep pre-claim deferred host-class framing:\n${blob}`,
    ).toBe(false);

    expect(
      /claimed[^.\n]{0,80}(PSL|eTLD|host.?class|redirect Auth drop|ambient suppress)|(?:PSL eTLD|credential host.?class|redirect Auth drop|ambient suppress)[^.\n]{0,80}claimed/i.test(
        blob,
      ),
      `Limitations must positively acknowledge the claimed §10.3 host-class floor:\n${blob}`,
    ).toBe(true);
  });

  test("Limitations still name soft zip / tar.gz debt and residual Auth depth", () => {
    const doc = loadChecklist();
    const blob = `${limitationsBlob(doc)}\n${scopeOutBlob(doc)}`;

    expect(blob, "soft zip / tar.gz").toMatch(/tar\.?gz|zip|sc-004|container/i);
    // Residual Auth depth beyond claimed floor (not the old "full AuthResolver deferred" blanket alone).
    expect(
      /gh\s*CLI|az\s*bearer|credential.?helper|try_with_fallback|residual Auth depth/i.test(blob),
      `residual Auth depth (gh/az/helper / try_with_fallback) must be named:\n${blob}`,
    ).toBe(true);
  });

  test("CONFORMANCE.md mirrors claimed floor (not wholly deferred host-class)", () => {
    expect(existsSync(conformanceMdPath), conformanceMdPath).toBe(true);
    const md = readText(conformanceMdPath);

    expect(
      /req-sc-003[\s\S]{0,200}active/i.test(md) ||
        /\|\s*req-sc-003\s*\|\s*MUST\s*\|[^|]*\|\s*active/i.test(md),
      "CONFORMANCE.md must show req-sc-003 active",
    ).toBe(true);

    expect(
      /thin marketplace env host unlock[\s\S]{0,80}not full OpenAPM §10\.3/i.test(md) &&
        /req-sc-003[\s\S]{0,120}skipped/i.test(md),
      "CONFORMANCE.md must not keep pre-claim skipped framing for host-class IDs",
    ).toBe(false);
  });

  test("CONFORMANCE.json marks claimed IDs active", () => {
    expect(existsSync(conformanceJsonPath)).toBe(true);
    const json = JSON.parse(readText(conformanceJsonPath)) as {
      requirements?: Array<{ id: string; status?: string }>;
    };
    const rows = json.requirements ?? [];
    for (const id of ["req-sc-003", "req-sc-005", "req-sc-008", "req-sc-013"]) {
      const row = rows.find((r) => r.id === id);
      expect(row, `CONFORMANCE.json missing ${id}`).toBeTruthy();
      expect(row!.status, `${id} in CONFORMANCE.json`).toBe("active");
    }
    const sc004 = rows.find((r) => r.id === "req-sc-004");
    expect(sc004?.status).toBe("skipped");
  });
});
