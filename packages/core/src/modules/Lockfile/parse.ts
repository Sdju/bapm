import { YamlError } from "@/common/yaml/errors.ts";
import { loadYamlDocument } from "@/common/yaml/loadDocument.ts";
import { LockfileError } from "./errors.ts";
import { DEP_HASH_SCALAR_KEYS, normalizeHashMap, normalizeHashValue } from "./hash.ts";
import { normalizePackageRepoUrl } from "./identity.ts";
import type { LockedDependency, LockfileDocument } from "./types.ts";

const SUPPORTED_VERSIONS = new Set(["1", "2"]);

/**
 * Load lockfile YAML with M1 safe-subset policy; map errors to LockfileError.
 */
export function loadLockfileYaml(source: string, sourcePath?: string): unknown {
  try {
    return loadYamlDocument(source, sourcePath);
  } catch (cause) {
    if (cause instanceof YamlError) {
      const code =
        cause.code === "YAML_SAFE_SUBSET" ? "LOCKFILE_YAML_SAFE_SUBSET" : "LOCKFILE_YAML_PARSE";
      throw new LockfileError(code, cause.message, {
        path: sourcePath ?? cause.path,
        cause,
      });
    }
    throw cause;
  }
}

/**
 * Validate a pre-parsed JS value as an OpenAPM/APM lockfile document.
 * Retains unknown top-level and per-entry keys (incl. `x-*`).
 */
export function parseLockfileDocument(input: unknown): LockfileDocument {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new LockfileError("LOCKFILE_FORMAT", "Lockfile root must be a YAML object/mapping");
  }

  const raw = input as Record<string, unknown>;

  if (!("dependencies" in raw)) {
    throw new LockfileError(
      "LOCKFILE_FORMAT",
      'Lockfile requires a "dependencies" list (req-lk-001)',
      { path: "dependencies" },
    );
  }

  if (!Array.isArray(raw.dependencies)) {
    throw new LockfileError("LOCKFILE_FORMAT", 'Lockfile "dependencies" must be a list', {
      path: "dependencies",
    });
  }

  let versionRaw = raw.lockfile_version;
  if (versionRaw === undefined || versionRaw === null) {
    versionRaw = "1";
  }
  if (typeof versionRaw !== "string" || !SUPPORTED_VERSIONS.has(versionRaw)) {
    throw new LockfileError(
      "LOCKFILE_UNSUPPORTED_VERSION",
      `Unsupported lockfile version ${JSON.stringify(versionRaw)}; ` +
        `supported versions: "1", "2". Upgrade or regenerate the lockfile (req-lk-004).`,
      { path: "lockfile_version" },
    );
  }

  const dependencies = raw.dependencies.map((entry, i) =>
    validateDependencyEntry(entry, `dependencies[${i}]`),
  );

  const document: LockfileDocument = {
    ...raw,
    lockfile_version: versionRaw as "1" | "2",
    dependencies,
  };

  if ("local_deployed_file_hashes" in raw && raw.local_deployed_file_hashes != null) {
    document.local_deployed_file_hashes = normalizeHashMap(
      raw.local_deployed_file_hashes,
    ) as Record<string, string>;
  }

  return document;
}

/**
 * Parse lockfile YAML text or an already-loaded JS value into a validated document.
 */
export function parseLockfile(input: string | object | null): LockfileDocument {
  if (typeof input === "string") {
    return parseLockfileDocument(loadLockfileYaml(input));
  }
  return parseLockfileDocument(input);
}

function validateDependencyEntry(entry: unknown, path: string): LockedDependency {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    throw new LockfileError("LOCKFILE_FORMAT", `Lockfile dependency at ${path} must be a mapping`, {
      path,
    });
  }

  const raw = { ...(entry as Record<string, unknown>) };

  if (typeof raw.repo_url !== "string" || !raw.repo_url.trim()) {
    throw new LockfileError(
      "LOCKFILE_VALIDATION",
      `Lockfile dependency at ${path} requires a non-empty "repo_url"`,
      { path: `${path}.repo_url` },
    );
  }

  const source = typeof raw.source === "string" ? raw.source : undefined;
  const host = typeof raw.host === "string" ? raw.host : undefined;
  const registryPrefix = typeof raw.registry_prefix === "string" ? raw.registry_prefix : undefined;

  const originalRepoUrl = raw.repo_url;
  const canonicalRepoUrl = normalizePackageRepoUrl(originalRepoUrl, {
    source,
    host,
    registryPrefix,
  });

  if (typeof raw.materialization_repo_url === "string" && raw.materialization_repo_url.length > 0) {
    const materializationIdentity = normalizePackageRepoUrl(raw.materialization_repo_url, {
      source,
      host,
      registryPrefix,
    });
    if (materializationIdentity !== canonicalRepoUrl) {
      throw new LockfileError(
        "LOCKFILE_VALIDATION",
        `materialization_repo_url ${JSON.stringify(raw.materialization_repo_url)} does not ` +
          `identify the same package as repo_url ${JSON.stringify(originalRepoUrl)} ` +
          `(identity mismatch, req-lk-022)`,
        { path: `${path}.materialization_repo_url` },
      );
    }
  }

  if (source === "registry") {
    if (typeof raw.resolved_url !== "string" || !raw.resolved_url.trim()) {
      throw new LockfileError(
        "LOCKFILE_VALIDATION",
        `Registry dependency at ${path} requires "resolved_url" (req-lk-003)`,
        { path: `${path}.resolved_url` },
      );
    }
    if (raw.resolved_hash === undefined || raw.resolved_hash === null || raw.resolved_hash === "") {
      throw new LockfileError(
        "LOCKFILE_VALIDATION",
        `Registry dependency at ${path} requires "resolved_hash" (req-lk-003)`,
        { path: `${path}.resolved_hash` },
      );
    }
  } else if (source !== "local" && source !== "marketplace") {
    // Git identity (default / git): require resolved_commit shape half of lk-003.
    if (typeof raw.resolved_commit !== "string" || !raw.resolved_commit.trim()) {
      throw new LockfileError(
        "LOCKFILE_VALIDATION",
        `Git dependency at ${path} requires "repo_url" and "resolved_commit" (req-lk-003)`,
        { path: `${path}.resolved_commit` },
      );
    }
  }

  const dep: LockedDependency = {
    ...raw,
    repo_url: canonicalRepoUrl,
  };

  if (
    typeof raw.materialization_repo_url === "string" &&
    raw.materialization_repo_url.length > 0 &&
    raw.materialization_repo_url !== canonicalRepoUrl
  ) {
    dep.materialization_repo_url = raw.materialization_repo_url;
  } else if (
    typeof raw.materialization_repo_url === "string" &&
    raw.materialization_repo_url === canonicalRepoUrl
  ) {
    // Same as identity spelling — drop redundant display field (APM behavior).
    delete dep.materialization_repo_url;
  }

  for (const key of DEP_HASH_SCALAR_KEYS) {
    if (key in dep && dep[key] != null) {
      dep[key] = normalizeHashValue(dep[key]) as string;
    }
  }

  if (dep.deployed_file_hashes != null) {
    dep.deployed_file_hashes = normalizeHashMap(dep.deployed_file_hashes) as Record<string, string>;
  }

  return dep;
}
