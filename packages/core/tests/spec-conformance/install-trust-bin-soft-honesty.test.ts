/**
 * Limitations honesty: hooks are gated when a trust surface / org deny is
 * active, legacy soft only without a surface; canvas remains unimplemented;
 * bin gated via ExecutableTrust + trust-bin consent.
 */
import { existsSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import {
  checklistPath,
  limitationsBlob,
  loadChecklist,
  scopeOutBlob,
} from "./sc-claims-helpers.ts";
import { conformanceMdPath, readText as readConformanceText } from "./helpers.ts";

function limitationsHonestyBlob(): string {
  const doc = loadChecklist();
  const md = existsSync(conformanceMdPath) ? readConformanceText(conformanceMdPath) : "";
  return `${limitationsBlob(doc)}\n${scopeOutBlob(doc)}\n${md}`;
}

describe("install-trust-bin — soft honesty (hooks gated with surface; canvas unimplemented)", () => {
  test("limitations MUST NOT bundle bin as ungated soft debt with hooks/canvas", () => {
    const blob = limitationsHonestyBlob();
    const doc = loadChecklist();
    const scope = scopeOutBlob(doc);

    // Trio wording that still bundles bin as ungated soft must leave.
    expect(
      /hooks\s*\/\s*bin\s*\/\s*canvas/i.test(blob) ||
        /hooks\/bin\/canvas/i.test(blob) ||
        (doc.scope_out ?? []).some((item) => /hooks\/bin\/canvas/i.test(String(item))),
      `expected hooks/bin/canvas ungated trio removed from limitations/scope_out (${checklistPath}):\n${blob}`,
    ).toBe(false);

    // hooks + canvas residual honesty must remain.
    expect(
      /hooks/i.test(blob) && /canvas/i.test(blob),
      `expected hooks and canvas residual still named:\n${blob}`,
    ).toBe(true);

    // Hooks are now gated when a surface / org deny exists (not the old soft trio).
    expect(
      /hooks?[^.\n]{0,160}(gated|withheld|ExecutableTrust)|ExecutableTrust[^.\n]{0,80}\bhook\b|type\s*[:=]?\s*["']?hook/i.test(
        blob,
      ),
      `expected dependency hooks documented as gated via ExecutableTrust(type hook):\n${blob}`,
    ).toBe(true);

    // Legacy no-surface behaviour must stay honest, not silently claimed as gated.
    expect(
      /no grant surface|without a grant surface|surface.{0,40}absent|legacy soft/i.test(blob),
      `expected legacy no-grant-surface hook behavior documented:\n${blob}`,
    ).toBe(true);

    // Canvas is still not implemented.
    expect(
      /canvas[^.\n]{0,160}(unimplemented|not implemented|soft|no primitive)/i.test(blob),
      `expected canvas unimplemented/soft honesty:\n${blob}`,
    ).toBe(true);

    // Bin gating documented as consent and/or ExecutableTrust (not second policy noun).
    expect(
      /trust-bin|no-trust-bin|ExecutableTrust|executables.*bin|bin.*consent|type\s*[:=]\s*["']?bin/i.test(
        blob,
      ),
      `expected bin consent / ExecutableTrust(bin) documented in limitations or CONFORMANCE:\n${blob}`,
    ).toBe(true);

    expect(
      /bin_deploy|second bin-only policy|parallel bin policy/i.test(blob),
      `must not invent a second bin-only policy noun:\n${blob}`,
    ).toBe(false);

    // scope_out should not keep the old MCP-only trio token.
    expect(
      /hooks\/bin\/canvas executable gates/i.test(scope),
      `scope_out still lists hooks/bin/canvas executable gates:\n${scope}`,
    ).toBe(false);
  });
});
