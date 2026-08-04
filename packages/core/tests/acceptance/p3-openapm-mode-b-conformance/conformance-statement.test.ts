/**
 * p3 / req-cf-002: published CONFORMANCE.md + CONFORMANCE.json claim posture.
 * Consumer + Producer claimed; Governance floor; Registry N/A (no rg-001 claim).
 */
import { expect, test, describe } from "vite-plus/test";
import { existsSync } from "node:fs";
import {
  conformanceJsonPath,
  conformanceMdPath,
  loadJsonFile,
  readText,
} from "./helpers.ts";

describe("p3 Mode B — published conformance statement (req-cf-002)", () => {
  test("CONFORMANCE.md exists at repository root", () => {
    expect(
      existsSync(conformanceMdPath),
      `expected ${conformanceMdPath}`,
    ).toBe(true);
  });

  test("CONFORMANCE.json exists at repository root", () => {
    expect(
      existsSync(conformanceJsonPath),
      `expected ${conformanceJsonPath}`,
    ).toBe(true);
  });

  test("statement declares OpenAPM v0.1 and class posture", () => {
    expect(existsSync(conformanceMdPath)).toBe(true);
    expect(existsSync(conformanceJsonPath)).toBe(true);

    const md = readText(conformanceMdPath);
    expect(md).toMatch(/v0\.1|0\.1/);
    expect(md).toMatch(/Consumer|consumer/i);
    expect(md).toMatch(/Producer|producer/i);
    expect(md).toMatch(/Governance|governance/i);
    expect(md).toMatch(/Registry|registry/i);

    // Registry must be N/A — not a full claim.
    expect(md).toMatch(/Registry[^\n]{0,80}(N\/A|n\/a|not claimed|deferred)/i);

    // Governance floor: remote/extends not fully claimed.
    expect(md).toMatch(/floor|local|limited/i);
    expect(md).toMatch(/extends|remote/i);

    const json = loadJsonFile(conformanceJsonPath) as Record<string, unknown>;
    const blob = JSON.stringify(json).toLowerCase();
    expect(blob).toMatch(/0\.1/);

    const classes = extractClasses(json);
    expect(classes.consumer, "Consumer must be claimed").toMatch(
      /claim|active|yes|true|floor|primary/i,
    );
    expect(classes.producer, "Producer must be claimed").toMatch(
      /claim|active|yes|true|floor/i,
    );
    expect(classes.governance, "Governance must be floor/limited").toMatch(
      /floor|limited|partial|local|claim/i,
    );
    expect(classes.registry, "Registry must be N/A").toMatch(
      /n\/a|na|not.?claimed|deferred|none|false/i,
    );
  });

  test("statement lists per-req rows including cf-001/cf-002; rg-001 not active", () => {
    expect(existsSync(conformanceMdPath)).toBe(true);
    expect(existsSync(conformanceJsonPath)).toBe(true);

    const md = readText(conformanceMdPath);
    expect(md).toMatch(/req-cf-001/);
    expect(md).toMatch(/req-cf-002/);

    const json = loadJsonFile(conformanceJsonPath) as Record<string, unknown>;
    const reqs = extractRequirements(json);
    expect(reqs.length).toBeGreaterThan(0);

    const cf001 = reqs.find((r) => r.id === "req-cf-001");
    const cf002 = reqs.find((r) => r.id === "req-cf-002");
    expect(cf001, "CONFORMANCE.json must include req-cf-001").toBeTruthy();
    expect(cf002, "CONFORMANCE.json must include req-cf-002").toBeTruthy();
    expect(String(cf001!.status ?? "active").toLowerCase()).toMatch(/active|pass/);
    expect(String(cf002!.status ?? "active").toLowerCase()).toMatch(/active|pass/);

    const rg = reqs.find((r) => r.id === "req-rg-001");
    if (rg) {
      expect(String(rg.status).toLowerCase()).toMatch(/n\/a|na|skipped|not.?claimed/);
      expect(String(rg.status).toLowerCase()).not.toMatch(/^(active|pass)$/);
    } else {
      // Omission of rg-001 is acceptable only if Registry class is N/A in header.
      const classes = extractClasses(json);
      expect(classes.registry).toMatch(/n\/a|na|not.?claimed|deferred|none|false/i);
    }
  });
});

function extractClasses(json: Record<string, unknown>): {
  consumer: string;
  producer: string;
  governance: string;
  registry: string;
} {
  const classes = (json.classes ?? json.conformance_classes ?? json.claims ?? json) as Record<
    string,
    unknown
  >;

  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const v = classes[key] ?? classes[key.toLowerCase()] ?? classes[capitalize(key)];
      if (v == null) continue;
      if (typeof v === "string" || typeof v === "boolean" || typeof v === "number") {
        return String(v);
      }
      if (typeof v === "object") {
        const o = v as Record<string, unknown>;
        return String(o.status ?? o.claim ?? o.state ?? JSON.stringify(o));
      }
    }
    // Fallback: scan markdown-like fields
    const blob = JSON.stringify(json);
    const re = new RegExp(`${keys[0]}[^\\n"]{0,60}`, "i");
    const m = blob.match(re);
    return m?.[0] ?? "";
  };

  return {
    consumer: pick("consumer", "Consumer"),
    producer: pick("producer", "Producer"),
    governance: pick("governance", "Governance"),
    registry: pick("registry", "Registry"),
  };
}

function extractRequirements(json: Record<string, unknown>): Array<{
  id: string;
  status?: string;
}> {
  const list =
    (json.requirements as unknown) ??
    (json.coverage as unknown) ??
    (json.reqs as unknown) ??
    [];
  if (!Array.isArray(list)) return [];
  return list.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id ?? r.req ?? r.req_id ?? ""),
      status: r.status != null ? String(r.status) : undefined,
    };
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
