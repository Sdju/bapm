/**
 * Soft honesty: bin gated via ExecutableTrust + trust-bin consent;
 * hooks/canvas remain ungated soft (executable-mcp-trust MODIFIED).
 */
import { describe, expect, test } from "vite-plus/test";
import { checklistPath, limitationsHonestyBlob, loadChecklist, scopeOutBlob } from "./helpers.ts";

describe("install-trust-bin — soft honesty (hooks/canvas vs bin)", () => {
  test("limitations MUST NOT claim bin remains ungated soft debt with hooks/canvas", () => {
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

    // hooks + canvas soft honesty must remain.
    expect(
      /hooks/i.test(blob) && /canvas/i.test(blob),
      `expected hooks and canvas soft residual still named:\n${blob}`,
    ).toBe(true);

    expect(
      /ungated|soft|MCP-only|mcp.?only|not gated/i.test(blob),
      `expected soft/ungated framing for hooks/canvas residual:\n${blob}`,
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
