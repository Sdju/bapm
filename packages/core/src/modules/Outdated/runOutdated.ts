import { resolve } from "node:path";
import { loadLockfileOrNull } from "@/modules/Lockfile";
import { loadManifest } from "@/modules/Manifest";
import {
  createDefaultGitRemote,
  createDefaultTagLister,
  pickHighestSatisfyingTag,
} from "@/modules/Resolver";
import { OutdatedError } from "./errors.ts";
import type { OutdatedResult, OutdatedRow, RunOutdatedOptions } from "./types.ts";

/**
 * Compare lock pins to remote tips / latest matching semver tags.
 * Exit 0 even when outdated rows exist; no lock → throw / non-success.
 */
export async function runOutdated(options: RunOutdatedOptions = {}): Promise<OutdatedResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const loaded = loadLockfileOrNull({ cwd });
  if (!loaded) {
    throw new OutdatedError(
      "OUTDATED_NO_LOCK",
      "No lockfile found; cannot check outdated packages",
    );
  }

  try {
    loadManifest({ cwd });
  } catch {
    /* optional for local-only locks */
  }

  const tagLister = options.tagLister ?? createDefaultTagLister();
  const gitRemote = options.gitRemote ?? createDefaultGitRemote();
  const rows: OutdatedRow[] = [];

  for (const dep of loaded.document.dependencies ?? []) {
    const name = String(dep.name ?? dep.repo_url ?? "unknown");
    const repo = String(dep.repo_url ?? "");
    const current =
      typeof dep.resolved_commit === "string"
        ? dep.resolved_commit
        : typeof dep.resolved_tag === "string"
          ? dep.resolved_tag
          : typeof dep.version === "string"
            ? dep.version
            : "";

    if (!repo || repo.startsWith("local:")) {
      rows.push({
        name,
        status: "up-to-date",
        current: current || "local",
        latest: current || "local",
        repo_url: repo,
      });
      continue;
    }

    const gitUrl = repo.includes("://") ? repo : `https://${repo}`;
    const constraint =
      typeof dep.constraint === "string"
        ? dep.constraint
        : typeof dep.resolved_tag === "string"
          ? inferConstraintFromTag(dep.resolved_tag)
          : undefined;

    try {
      if (constraint) {
        const tags = await tagLister.listTags(gitUrl);
        const picked = pickHighestSatisfyingTag(
          tags.map((t) => t.tag),
          constraint,
        );
        if (!picked) {
          rows.push({ name, status: "unknown", current, repo_url: repo });
          continue;
        }
        const hit = tags.find((t) => t.tag === picked)!;
        const latestCommit = hit.commit;
        const latestTag = picked;
        const isOutdated =
          (current && latestCommit && current !== latestCommit) ||
          (typeof dep.resolved_tag === "string" && dep.resolved_tag !== latestTag);
        rows.push({
          name,
          status: isOutdated ? "outdated" : "up-to-date",
          current: typeof dep.resolved_tag === "string" ? dep.resolved_tag : current,
          latest: latestTag,
          repo_url: repo,
        });
      } else {
        const tip = await gitRemote.resolveRef(gitUrl, "HEAD");
        const isOutdated = Boolean(current && tip && current !== tip);
        rows.push({
          name,
          status: isOutdated ? "outdated" : "up-to-date",
          current,
          latest: tip,
          repo_url: repo,
        });
      }
    } catch {
      rows.push({ name, status: "unknown", current, repo_url: repo });
    }
  }

  const hasOutdated = rows.some((r) => r.status === "outdated");
  const text = hasOutdated
    ? formatRows(rows)
    : rows.every((r) => r.status === "up-to-date")
      ? "All dependencies are up-to-date"
      : formatRows(rows);

  return { ok: true, exitCode: 0, rows, text, message: text };
}

export const checkOutdated = runOutdated;
export const outdated = runOutdated;

function inferConstraintFromTag(tag: string): string {
  const v = tag.replace(/^v/, "");
  const parts = v.split(".");
  if (parts.length >= 1 && /^\d+$/.test(parts[0]!)) {
    return `^${parts[0]}.0.0`;
  }
  return `^${v}`;
}

function formatRows(rows: OutdatedRow[]): string {
  return rows
    .map((r) => `${r.name}\t${r.status}\tcurrent=${r.current ?? "-"}\tlatest=${r.latest ?? "-"}`)
    .join("\n");
}
