/**
 * p6d-policy-status acceptance helpers (core).
 */
import * as core from "@bapm/core";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type TempProject = { cwd: string; cleanup: () => void };

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

/** Core status helper — design: `runPolicyStatus`. */
export function getRunPolicyStatus(): (options?: Record<string, unknown>) => unknown {
  return pickExport(
    ["runPolicyStatus", "getPolicyStatus", "policyStatus"],
    "policy status report",
  ) as (options?: Record<string, unknown>) => unknown;
}

export function createTempProject(prefix = "bapm-p6d-core-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export function writePolicy(
  cwd: string,
  filename: "apm-policy.yml" | "bapm-policy.yml" | string,
  contents: string,
): string {
  const path = join(cwd, filename);
  writeText(path, contents);
  return path;
}

export function writeLeafProject(cwd: string, name: string): void {
  mkdirSync(join(cwd, "leaf"), { recursive: true });
  writeText(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
  );
  writeText(
    join(cwd, "leaf", "apm.yml"),
    `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
  );
}

export const MINIMAL_WARN = `name: org
enforcement: warn
`;

export const RICH_LOCAL = `name: rich-local
enforcement: block
dependencies:
  allow:
    - safe/*
  deny:
    - evil/*
    - bad/actor
  require:
    - org/baseline
  max_depth: 3
  require_pinned_constraint: true
`;

export function asReport(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("expected PolicyStatusReport object");
  }
  return value as Record<string, unknown>;
}

/** Resolve a dependencies.* family count from flexible report shapes. */
export function ruleCountOf(report: Record<string, unknown>, family: string): number {
  const rc = report.rule_counts;
  if (!rc || typeof rc !== "object" || Array.isArray(rc)) {
    throw new TypeError("expected rule_counts object on PolicyStatusReport");
  }
  const bag = rc as Record<string, unknown>;
  const deps =
    bag.dependencies && typeof bag.dependencies === "object" && !Array.isArray(bag.dependencies)
      ? (bag.dependencies as Record<string, unknown>)
      : undefined;

  const candidates: unknown[] = [
    bag[family],
    bag[`dependencies_${family}`],
    bag[`dependencies.${family}`],
    deps?.[family],
  ];

  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c;
    if (typeof c === "boolean") return c ? 1 : 0;
  }
  throw new TypeError(`rule_counts missing family "${family}"`);
}

export function fingerprintTree(root: string): string {
  const parts: string[] = [];
  const walk = (dir: string, rel = ""): void => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const childRel = rel ? `${rel}/${name}` : name;
      const st = statSync(full);
      if (st.isDirectory()) walk(full, childRel);
      else {
        const body = readFileSync(full);
        parts.push(
          `${childRel}:${st.size}:${createHash("sha256").update(body).digest("hex")}`,
        );
      }
    }
  };
  if (existsSync(root)) walk(root);
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

export function projectFingerprint(cwd: string): string {
  const keys = ["bapm.yml", "apm.yml", "bapm.lock.yaml", "apm.lock.yaml", "apm_modules", "bapm_modules"];
  const parts: string[] = [];
  for (const key of keys) {
    const full = join(cwd, key);
    if (!existsSync(full)) continue;
    const st = statSync(full);
    if (st.isDirectory()) parts.push(`${key}:dir:${fingerprintTree(full)}`);
    else {
      const body = readFileSync(full);
      parts.push(`${key}:file:${createHash("sha256").update(body).digest("hex")}`);
    }
  }
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

export { existsSync, join, readFileSync };
