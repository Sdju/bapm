import { resolve } from "node:path";
import { loadLockfileOrNull } from "@/modules/Lockfile";
import type { DepsWhyResult, RunDepsOptions } from "./types.ts";

/**
 * Offline reverse walk from lock edges (rs-005 SHOULD).
 */
export function whyDeps(options: RunDepsOptions = {}): DepsWhyResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const target = options.package ?? options.name ?? options.packages?.[0] ?? "";
  const loaded = loadLockfileOrNull({ cwd });
  const deps = loaded?.document.dependencies ?? [];

  const parentsOf = new Map<string, string[]>();
  for (const d of deps) {
    const name = String(d.name ?? "");
    if (!name) continue;
    const by = d.resolved_by;
    const parents = Array.isArray(by)
      ? by.map(String)
      : typeof by === "string"
        ? by
            .split(/->|,/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    parentsOf.set(
      name,
      parents.map((p) => (p.includes("@") ? p.split("@")[0]! : p)),
    );
  }

  const chains: string[][] = [];
  function walk(node: string, path: string[]): void {
    const parents = parentsOf.get(node) ?? [];
    if (parents.length === 0) {
      chains.push([...path].reverse());
      return;
    }
    for (const p of parents) {
      if (path.includes(p)) continue;
      walk(p, [...path, p]);
    }
  }

  if (target) {
    walk(target, [target]);
  }

  chains.sort((a, b) => a.join("\0").localeCompare(b.join("\0")));
  const text =
    chains.length === 0
      ? `No dependency chains found for ${target || "(missing package)"}`
      : chains.map((c) => c.join(" → ")).join("\n");

  return { ok: true, exitCode: 0, chains, text };
}

export const depsWhy = whyDeps;
export const runDepsWhy = whyDeps;
