#!/usr/bin/env node
/**
 * Generate repo-root CONFORMANCE.md + CONFORMANCE.json from the Mode B checklist.
 *
 * Usage (from repo root):
 *   node scripts/gen-conformance-statement.mjs
 *   pnpm run conformance:gen
 *
 * Drift gate:
 *   pnpm run conformance:check
 *   → regenerates then `git diff --exit-code CONFORMANCE.md CONFORMANCE.json`
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const checklistPath = join(repoRoot, "tests/spec-conformance/checklist.yml");
const outMd = join(repoRoot, "CONFORMANCE.md");
const outJson = join(repoRoot, "CONFORMANCE.json");

// Resolve `yaml` via @b-apm/core (catalog dep) so root scripts need no extra install.
const requireFromCore = createRequire(join(repoRoot, "packages/core/package.json"));
const { parse: parseYaml } = requireFromCore("yaml");

const GENERATOR = "scripts/gen-conformance-statement.mjs v1";

function loadChecklist() {
  const doc = parseYaml(readFileSync(checklistPath, "utf8"));
  if (!doc || typeof doc !== "object") {
    throw new Error(`invalid checklist at ${checklistPath}`);
  }
  const requirements = doc.requirements ?? doc.checklist ?? doc.rows;
  if (!Array.isArray(requirements)) {
    throw new Error("checklist.requirements must be an array");
  }
  return { doc, requirements };
}

function fixtureList(row) {
  const f = row.fixture ?? row.fixtures ?? row.fixture_path ?? row.fixture_paths;
  if (!f) return [];
  return Array.isArray(f) ? f.map(String) : [String(f)];
}

function citationOf(row) {
  return String(row.citation ?? row.assertion ?? row.test ?? row.tests ?? "");
}

function normalizeStatus(s) {
  const v = String(s ?? "").toLowerCase();
  if (v === "na") return "n/a";
  return v;
}

function buildJson({ doc, requirements }) {
  const posture = doc.claim_posture ?? {
    consumer: "claimed",
    producer: "claimed",
    governance: "floor",
    registry: "n/a",
  };

  const classes = {
    consumer: String(posture.consumer ?? "claimed"),
    producer: String(posture.producer ?? "claimed"),
    governance: String(posture.governance ?? "floor"),
    registry: String(posture.registry ?? "n/a"),
  };

  const rows = requirements.map((r) => {
    const status = normalizeStatus(r.status);
    const fixtures = fixtureList(r);
    const citation = citationOf(r);
    const entry = {
      id: String(r.id),
      keyword: r.keyword != null ? String(r.keyword) : undefined,
      section: r.section != null ? String(r.section) : undefined,
      conformance_class: String(r.class ?? r.conformance_class ?? ""),
      status,
    };
    if (fixtures.length) entry.fixtures = fixtures;
    if (citation) entry.citation = citation;
    if (r.rationale || r.waiver || r.waiver_rationale) {
      entry.rationale = String(r.rationale ?? r.waiver ?? r.waiver_rationale);
    }
    if (Array.isArray(r.tests)) entry.tests = r.tests.map(String);
    else if (typeof r.tests === "string") entry.tests = [r.tests];
    return entry;
  });

  rows.sort((a, b) => a.id.localeCompare(b.id));

  return {
    generator: GENERATOR,
    spec_version: String(doc.spec_version ?? "v0.1"),
    openapm_version: "v0.1",
    classes,
    claim_posture: classes,
    optional_features: Array.isArray(doc.optional_features) ? doc.optional_features : [],
    limitations: Array.isArray(doc.limitations) ? doc.limitations : [],
    scope_out: Array.isArray(doc.scope_out) ? doc.scope_out : [],
    requirements: rows,
  };
}

function summaryByClass(requirements) {
  const out = {};
  for (const r of requirements) {
    const klass = String(r.conformance_class || r.class || "unknown").toLowerCase();
    const status = normalizeStatus(r.status);
    if (!out[klass]) out[klass] = { active: 0, skipped: 0, "n/a": 0 };
    if (status === "active") out[klass].active += 1;
    else if (status === "n/a") out[klass]["n/a"] += 1;
    else out[klass].skipped += 1;
  }
  return out;
}

function buildMarkdown(json) {
  const lines = [];
  lines.push("# OpenAPM Conformance Statement — v0.1 (bapm)");
  lines.push("");
  lines.push(`Generator: ${json.generator}`);
  lines.push("Spec: OpenAPM `v0.1`");
  lines.push("");
  lines.push("This file is generated. Do NOT edit by hand. Run");
  lines.push(
    "`pnpm run conformance:gen` (or `node scripts/gen-conformance-statement.mjs`) to regenerate.",
  );
  lines.push("Drift gate: `pnpm run conformance:check`.");
  lines.push("");
  lines.push("## Honesty contract");
  lines.push("");
  lines.push(
    "A requirement marked `status=active` is exercised by at least one fixture and/or assertion citation.",
  );
  lines.push(
    "A requirement marked `status=skipped` carries a written rationale (debt, not coverage).",
  );
  lines.push("A requirement marked `status=n/a` is outside the claimed class surface.");
  lines.push("");
  lines.push("## Conformance classes");
  lines.push("");
  lines.push("| Class | Posture | Notes |");
  lines.push("|-------|---------|-------|");
  lines.push(
    `| Consumer | **${json.classes.consumer}** | Primary claim (cursor deploy matrix; waivers below) |`,
  );
  lines.push(`| Producer | **${json.classes.producer}** | init/pack/pr-004 surface |`);
  const govNotes =
    String(json.classes.governance).toLowerCase() === "claimed"
      ? "Ordered providers `local` then `github-owner-dotgithub`; extends resolve/merge + host-class pin"
      : "Local dual-read + install gate; remote providers and `extends` not claimed";
  const govLabel =
    String(json.classes.governance).toLowerCase() === "claimed"
      ? `**${json.classes.governance}**`
      : `**${json.classes.governance}** (local floor)`;
  lines.push(`| Governance | ${govLabel} | ${govNotes} |`);
  lines.push(
    `| Registry | **${json.classes.registry}** | No registry host; req-rg-001 not claimed |`,
  );
  lines.push("");
  lines.push("## Coverage summary");
  lines.push("");
  lines.push("| Class | Active | Skipped | N/A |");
  lines.push("|-------|-------:|--------:|----:|");
  const summary = summaryByClass(json.requirements);
  for (const klass of ["producer", "consumer", "governance", "registry"]) {
    const s = summary[klass] ?? { active: 0, skipped: 0, "n/a": 0 };
    lines.push(
      `| ${klass[0].toUpperCase()}${klass.slice(1)} | ${s.active} | ${s.skipped} | ${s["n/a"]} |`,
    );
  }
  lines.push("");
  lines.push("## Limitations / non-conformance");
  lines.push("");
  for (const item of json.limitations) {
    lines.push(`- ${item}`);
  }
  if (json.scope_out?.length) {
    lines.push("");
    lines.push("### Scope out");
    lines.push("");
    for (const item of json.scope_out) {
      lines.push(`- ${item}`);
    }
  }
  lines.push("");
  lines.push("## Per-requirement coverage");
  lines.push("");
  lines.push("| Req ID | Keyword | Sec | Class | Status | Citation / fixture |");
  lines.push("|--------|---------|-----|-------|--------|--------------------|");
  for (const r of json.requirements) {
    const fixtures = (r.fixtures ?? []).join("; ");
    const cite = r.citation ?? "";
    const rationale = r.rationale ? ` — ${r.rationale}` : "";
    const evidence = [cite, fixtures].filter(Boolean).join(" · ") + rationale;
    lines.push(
      `| ${r.id} | ${r.keyword ?? ""} | ${r.section ?? ""} | ${r.conformance_class} | ${r.status} | ${evidence.replace(/\|/g, "\\|")} |`,
    );
  }
  lines.push("");
  lines.push("## Waivers");
  lines.push("");
  const waived = json.requirements.filter((r) => r.status === "skipped" || r.status === "n/a");
  if (!waived.length) {
    lines.push("_None._");
  } else {
    for (const r of waived) {
      lines.push(`- **${r.id}** (${r.status}): ${r.rationale ?? "see limitations / scope out"}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

const loaded = loadChecklist();
const json = buildJson(loaded);
const md = buildMarkdown(json);

writeFileSync(outJson, `${JSON.stringify(json, null, 2)}\n`, "utf8");
writeFileSync(outMd, md, "utf8");
console.log(`Wrote ${outMd}`);
console.log(`Wrote ${outJson}`);
console.log(
  `Requirements: ${json.requirements.length} (active=${json.requirements.filter((r) => r.status === "active").length})`,
);
