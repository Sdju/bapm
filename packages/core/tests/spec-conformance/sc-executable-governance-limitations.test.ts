/**
 * Limitations honesty after executable governance claims
 * (promoted from sc-executable-governance).
 * Checklist is source of truth; CONFORMANCE.* via conformance:check.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  ABSOLUTE_APPROVE_OOS,
  limitationsBlob,
  loadChecklist,
  scopeOutBlob,
} from "./sc-claims-helpers.ts";

describe("sc-executable-governance Limitations honesty", () => {
  test("interactive approve/deny is not absolute OOS for claimed sc-010 surface", () => {
    const doc = loadChecklist();
    const blob = `${limitationsBlob(doc)}\n${scopeOutBlob(doc)}`;

    expect(
      ABSOLUTE_APPROVE_OOS.test(blob) ||
        /Approve\/deny interactive UX and org executable deny-wins fidelity are out of scope/i.test(
          blob,
        ),
      `limitations/scope_out still blanket approve as absolute OOS:\n${blob}`,
    ).toBe(false);

    // Bare scope_out token "approve/deny UX" as absolute residual must leave after claim.
    expect(
      (doc.scope_out ?? []).some((item) => /^approve\/deny UX$/i.test(String(item).trim())),
      `scope_out still lists bare approve/deny UX:\n${scopeOutBlob(doc)}`,
    ).toBe(false);
  });

  test("soft zip residual still named; MCP-only soft honesty for hooks/bin/canvas; §10.3 floor acknowledged", () => {
    const doc = loadChecklist();
    const blob = `${limitationsBlob(doc)}\n${scopeOutBlob(doc)}`;

    expect(blob).toMatch(/host.?class|AuthResolver|§\s*10\.3|PSL|ambient|redirect Auth/i);
    expect(blob).toMatch(/tar\.?gz|zip|caps?|container/i);
    expect(blob).toMatch(/hooks|bin|canvas|MCP-only|mcp.?only|ungated/i);
  });
});
