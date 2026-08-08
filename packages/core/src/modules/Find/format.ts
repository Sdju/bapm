import type { LockedDependency } from "@/modules/Lockfile";
import { asText } from "@/util/asText.ts";
import { WORKSPACE_OWNER_KEY } from "./types.ts";

/**
 * Human owner label: workspace `.`; else `repo_url` if set, otherwise `name`.
 */
export function formatFindOwnerLabel(
  owner: string | LockedDependency | Record<string, unknown>,
  dep?: LockedDependency | Record<string, unknown> | null,
): string {
  if (typeof owner === "string") {
    if (owner === WORKSPACE_OWNER_KEY) return WORKSPACE_OWNER_KEY;
    const d = dep ?? null;
    if (d) return labelFromDep(d);
    return owner;
  }
  return labelFromDep(owner);
}

export const ownerLabel = formatFindOwnerLabel;
export const formatOwnerLabel = formatFindOwnerLabel;
export const findOwnerLabel = formatFindOwnerLabel;

function labelFromDep(dep: LockedDependency | Record<string, unknown>): string {
  const repo = dep.repo_url != null ? asText(dep.repo_url).trim() : "";
  if (repo) return repo;
  const name = dep.name != null ? asText(dep.name).trim() : "";
  return name || WORKSPACE_OWNER_KEY;
}

/**
 * Origin fragment for `--source` (APM priority).
 * Workspace owner → `.  (workspace)`.
 */
export function formatFindOrigin(
  owner: string | LockedDependency | Record<string, unknown> | null | undefined,
  dep?: LockedDependency | Record<string, unknown> | null,
): string {
  if (owner === WORKSPACE_OWNER_KEY) {
    return `${WORKSPACE_OWNER_KEY}  (workspace)`;
  }

  const d =
    dep ??
    (owner && typeof owner === "object"
      ? (owner as LockedDependency | Record<string, unknown>)
      : null);
  if (!d) return typeof owner === "string" ? owner : "";

  const resolvedUrl = d.resolved_url != null ? asText(d.resolved_url).trim() : "";
  if (resolvedUrl.startsWith("oci://")) return resolvedUrl;

  const source = d.source != null ? asText(d.source) : "";
  const localPath = asText(d.local_path ?? d.path ?? "").trim();
  if (localPath && (source === "local" || d.local_path != null || d.path != null)) {
    // Prefer local when source is local, or local_path/path is set (design D6)
    if (source === "local" || d.local_path != null) return localPath;
  }

  const repo = d.repo_url != null ? asText(d.repo_url) : "";
  const resolvedRef = d.resolved_ref != null ? asText(d.resolved_ref) : "";
  if (resolvedRef) return repo ? `${repo}@${resolvedRef}` : resolvedRef;

  const resolvedTag = d.resolved_tag != null ? asText(d.resolved_tag) : "";
  if (resolvedTag) return repo ? `${repo}@${resolvedTag}` : resolvedTag;

  const commitRaw =
    (d.resolved_commit != null && asText(d.resolved_commit)) ||
    (d.resolved_hash != null && asText(d.resolved_hash)) ||
    "";
  if (commitRaw) {
    const commit = commitRaw.slice(0, 12);
    return repo ? `${repo}@${commit}` : commit;
  }

  return repo;
}

export const formatOrigin = formatFindOrigin;
export const formatSourceOrigin = formatFindOrigin;
export const _formatOrigin = formatFindOrigin;
