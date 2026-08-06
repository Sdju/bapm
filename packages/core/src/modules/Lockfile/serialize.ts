import { stringify } from "yaml";
import type { LockedDependency, LockfileDocument, LockfileInput } from "./types.ts";

/**
 * Serialize a lockfile document to YAML.
 * - Always emits explicit `lockfile_version`
 * - Forces `"2"` when any `source: registry` or git-semver fields present
 * - Never demotes a loaded `"2"` → `"1"` (OpenAPM req-lk-002 monotonic)
 * - Sorts dependencies by `(repo_url, virtual_path)`
 * - Omits unset/null placeholders; preserves unknown / `x-*` bags
 */
export function serializeLockfile(document: LockfileInput): string {
  const doc = asDocument(document);
  const emitVersion = resolveEmitVersion(doc);
  const deps = [...doc.dependencies]
    .filter((d) => !isSelfDependency(d))
    .sort(compareDeps)
    .map((d) => dependencyToPlain(d));

  const out: Record<string, unknown> = {
    lockfile_version: emitVersion,
  };

  // Preserve known optional top-level fields in a stable-ish order, then unknowns.
  const knownOrder = [
    "generated_at",
    "apm_version",
    "dependencies",
    "deployments",
    "mcp_servers",
    "mcp_configs",
    "mcp_target_servers",
    "mcp_config_provenance",
    "lsp_servers",
    "lsp_configs",
    "local_deployed_files",
    "local_deployed_file_hashes",
  ] as const;

  const reserved = new Set<string>(["lockfile_version", "dependencies", ...knownOrder]);

  for (const key of knownOrder) {
    if (key === "dependencies") {
      out.dependencies = deps;
      continue;
    }
    if (key in doc && doc[key] !== undefined && doc[key] !== null) {
      const value = doc[key];
      if (isEmptyOptional(value)) continue;
      out[key] = value;
    }
  }

  for (const [key, value] of Object.entries(doc)) {
    if (reserved.has(key)) continue;
    if (value === undefined || value === null) continue;
    out[key] = value;
  }

  // Ensure dependencies always present even if knownOrder loop was skipped somehow.
  out.dependencies = deps;
  out.lockfile_version = emitVersion;

  return stringify(out, {
    lineWidth: 0,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  });
}

function asDocument(input: LockfileInput): LockfileDocument {
  const raw = input as Record<string, unknown>;
  const dependencies = Array.isArray(raw.dependencies)
    ? (raw.dependencies as LockedDependency[])
    : [];
  const version = raw.lockfile_version === "2" ? "2" : "1";
  return { ...raw, lockfile_version: version, dependencies };
}

function resolveEmitVersion(document: LockfileDocument): "1" | "2" {
  if (document.lockfile_version === "2") {
    return "2";
  }
  for (const dep of document.dependencies ?? []) {
    if (dep.source === "registry") return "2";
    if (dep.constraint != null || dep.resolved_tag != null || dep.resolved_at != null) {
      return "2";
    }
  }
  return "1";
}

function isSelfDependency(dep: LockedDependency): boolean {
  return (
    dep.repo_url === "." ||
    dep.repo_url === "<self>" ||
    dep.virtual_path === "." ||
    dep.local_path === "."
  );
}

function compareDeps(a: LockedDependency, b: LockedDependency): number {
  const repoCmp = String(a.repo_url).localeCompare(String(b.repo_url));
  if (repoCmp !== 0) return repoCmp;
  const av = a.virtual_path == null ? "" : String(a.virtual_path);
  const bv = b.virtual_path == null ? "" : String(b.virtual_path);
  return av.localeCompare(bv);
}

function dependencyToPlain(dep: LockedDependency): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  // Stable-ish field order for readability; unknowns appended.
  const preferred = [
    "repo_url",
    "materialization_repo_url",
    "name",
    "version",
    "host",
    "host_type",
    "port",
    "registry_prefix",
    "source",
    "resolved_commit",
    "resolved_ref",
    "resolved_url",
    "resolved_hash",
    "constraint",
    "resolved_tag",
    "resolved_at",
    "tree_sha256",
    "virtual_path",
    "depth",
    "is_dev",
    "local_path",
    "package_type",
    "deployed_files",
    "deployed_file_hashes",
    "discovered_via",
    "marketplace_plugin_name",
    "source_url",
    "source_digest",
  ];

  const seen = new Set<string>();
  for (const key of preferred) {
    if (!(key in dep)) continue;
    const value = dep[key];
    if (value === undefined || value === null) continue;
    if (isEmptyOptional(value)) continue;
    out[key] = value;
    seen.add(key);
  }

  for (const [key, value] of Object.entries(dep)) {
    if (seen.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (isEmptyOptional(value)) continue;
    out[key] = value;
  }

  return out;
}

function isEmptyOptional(value: unknown): boolean {
  if (value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as object).length === 0
  ) {
    return true;
  }
  return false;
}
