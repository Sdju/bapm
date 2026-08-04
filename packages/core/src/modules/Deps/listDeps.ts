import { resolve } from "node:path";
import { loadLockfileOrNull } from "@/modules/Lockfile";
import type { DepsListResult, RunDepsOptions } from "./types.ts";

export function listDeps(options: RunDepsOptions = {}): DepsListResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const loaded = loadLockfileOrNull({ cwd });
  const packages = (loaded?.document.dependencies ?? []).map((d) => ({
    name: d.name ?? d.repo_url,
    version: d.version ?? d.resolved_tag ?? d.resolved_commit,
    source: d.source ?? (String(d.repo_url ?? "").startsWith("local:") ? "local" : "git"),
    repo_url: d.repo_url,
  }));
  const text = packages.map((p) => `${p.name}\t${p.version ?? "-"}\t${p.source}`).join("\n");
  return { ok: true, exitCode: 0, packages, text: text || "(no dependencies)" };
}

export const depsList = listDeps;
export const runDepsList = listDeps;
