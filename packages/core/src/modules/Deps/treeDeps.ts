import { resolve } from "node:path";
import { loadLockfileOrNull, type LockedDependency } from "@/modules/Lockfile";
import type { DepsTreeResult, RunDepsOptions } from "./types.ts";

type TreeNode = { name: string; children: TreeNode[] };

export function treeDeps(options: RunDepsOptions = {}): DepsTreeResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const loaded = loadLockfileOrNull({ cwd });
  const deps = loaded?.document.dependencies ?? [];
  const byName = new Map<string, LockedDependency>();
  for (const d of deps) {
    const name = String(d.name ?? d.repo_url ?? "");
    if (name) byName.set(name, d);
  }

  const childEdges = new Map<string, string[]>();
  for (const d of deps) {
    const name = String(d.name ?? "");
    if (!name) continue;
    const nested = d.dependencies;
    if (Array.isArray(nested)) {
      const kids = nested.map((x) => {
        if (typeof x === "string") {
          // may be repo_url — map to name
          for (const [n, dep] of byName) {
            if (n === x || String(dep.repo_url ?? "") === x) return n;
          }
          return x.split("/").pop() ?? x;
        }
        return String(x);
      });
      childEdges.set(name, kids);
    }
  }

  // Also invert resolved_by
  for (const d of deps) {
    const name = String(d.name ?? "");
    const by = d.resolved_by;
    const parents = Array.isArray(by) ? by.map(String) : typeof by === "string" ? [by] : [];
    for (const p of parents) {
      const parentName = p.includes("->") ? p.split("->").pop()!.split("@")[0]! : p;
      const list = childEdges.get(parentName) ?? [];
      if (name && !list.includes(name)) list.push(name);
      childEdges.set(parentName, list);
    }
  }

  const roots = deps.filter((d) => {
    const name = String(d.name ?? "");
    const by = d.resolved_by;
    const parents = Array.isArray(by) ? by : typeof by === "string" ? [by] : [];
    return parents.length === 0 || !deps.some((x) => String(x.name ?? "") !== name);
  });

  // Prefer deps without resolved_by as roots; if all have parents, use all
  let rootNames = deps
    .filter((d) => {
      const by = d.resolved_by;
      return !by || (Array.isArray(by) && by.length === 0);
    })
    .map((d) => String(d.name ?? d.repo_url ?? ""));

  if (rootNames.length === 0) {
    rootNames = deps.map((d) => String(d.name ?? d.repo_url ?? "")).filter(Boolean);
  }

  void roots;

  const tree: TreeNode[] = rootNames
    .filter(Boolean)
    .map((n) => buildNode(n, childEdges, new Set()));
  const text = renderTree(tree);
  return {
    ok: true,
    exitCode: 0,
    tree,
    text: text || "(empty tree)",
  };
}

export const depsTree = treeDeps;
export const runDepsTree = treeDeps;

function buildNode(name: string, edges: Map<string, string[]>, seen: Set<string>): TreeNode {
  if (seen.has(name)) return { name, children: [] };
  const next = new Set(seen);
  next.add(name);
  const kids = (edges.get(name) ?? []).map((c) => buildNode(c, edges, next));
  return { name, children: kids };
}

function renderTree(nodes: TreeNode[], prefix = ""): string {
  const lines: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    const last = i === nodes.length - 1;
    const branch = prefix === "" ? "" : last ? "└─ " : "├─ ";
    lines.push(`${prefix}${branch}${n.name}`);
    if (n.children.length > 0) {
      const childPrefix = prefix === "" ? "  " : `${prefix}${last ? "   " : "│  "}`;
      lines.push(renderTree(n.children, childPrefix));
    }
  }
  return lines.filter(Boolean).join("\n");
}
