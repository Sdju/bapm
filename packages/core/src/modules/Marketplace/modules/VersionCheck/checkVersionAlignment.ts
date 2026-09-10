import { resolve } from "node:path";
import type { MarketplaceAuthoringConfig, PackageEntry } from "../Authoring/types.ts";
import { readLocalVersion } from "./readLocalVersion.ts";
import { renderTag } from "./renderTag.ts";
import type {
  CheckVersionAlignmentOptions,
  PackageVersionRow,
  VersionAlignmentReport,
} from "./types.ts";

function isLocalPackage(entry: PackageEntry): boolean {
  if (entry.isLocal || entry.is_local) return true;
  const src = entry.source ?? "";
  return src.startsWith("./") || src.startsWith("../");
}

function localPath(entry: PackageEntry): string {
  let src = (entry.source ?? "").replace(/\/+$/, "");
  if (src.startsWith("./")) src = src.slice(2);
  return src;
}

function defaultTagPattern(config: MarketplaceAuthoringConfig): string {
  return config.build?.tagPattern ?? "v{version}";
}

function resolveTagPattern(entry: PackageEntry, defaultPattern: string): string {
  return entry.tag_pattern ?? defaultPattern;
}

/**
 * Marketplace local-package version-alignment gate (APM `check_version_alignment`).
 * Pure / no network — distinct from `checkReleaseTag`.
 */
export function checkVersionAlignment(
  options: CheckVersionAlignmentOptions,
): VersionAlignmentReport {
  const config = options.config;
  const projectRoot = resolve(options.projectRoot ?? options.root ?? options.cwd ?? process.cwd());
  const strategy = config.versioning?.strategy ?? "lockstep";
  const localEntries = config.packages.filter(isLocalPackage);
  const rows: PackageVersionRow[] = [];
  const rendered = new Map<string, string>();
  const buildPattern = defaultTagPattern(config);

  for (const entry of localEntries) {
    const rel = localPath(entry);
    const { version, status } = readLocalVersion(projectRoot, rel);

    if (status !== "ok") {
      rows.push({ path: rel, version: null, ok: false, reason: status, error: status });
      continue;
    }

    if (strategy === "lockstep") {
      if (version === config.version) {
        rows.push({ path: rel, version, ok: true, reason: "matches" });
      } else {
        const reason = `drift:expected=${config.version ?? ""}`;
        rows.push({ path: rel, version, ok: false, reason, error: reason });
      }
      continue;
    }

    if (strategy === "tag_pattern") {
      const pattern = resolveTagPattern(entry, buildPattern);
      let tag: string;
      try {
        tag = renderTag(pattern, entry.name, version!);
      } catch {
        rows.push({
          path: rel,
          version,
          ok: false,
          reason: "missing_version",
          error: "missing_version",
          rendered_tag: null,
        });
        continue;
      }
      if (rendered.has(tag)) {
        const other = rendered.get(tag)!;
        rows.push({
          path: rel,
          version,
          ok: false,
          reason: `duplicate_tag:other=${other}`,
          error: `duplicate_tag:other=${other}`,
          rendered_tag: tag,
        });
        for (let i = 0; i < rows.length - 1; i++) {
          const prev = rows[i]!;
          if (prev.path === other && prev.ok) {
            rows[i] = {
              path: prev.path,
              version: prev.version,
              ok: false,
              reason: `duplicate_tag:other=${rel}`,
              error: `duplicate_tag:other=${rel}`,
              rendered_tag: prev.rendered_tag,
            };
            break;
          }
        }
        rendered.set(tag, rel);
      } else {
        rendered.set(tag, rel);
        rows.push({
          path: rel,
          version,
          ok: true,
          reason: "matches",
          rendered_tag: tag,
        });
      }
      continue;
    }

    if (strategy === "per_package") {
      rows.push({ path: rel, version, ok: true, reason: "matches" });
      continue;
    }

    const unknown = String(strategy);
    rows.push({
      path: rel,
      version,
      ok: false,
      reason: `unknown_strategy:${unknown}`,
      error: `unknown_strategy:${unknown}`,
    });
  }

  const packages = [...rows].sort((a, b) => a.path.localeCompare(b.path));
  const expected = strategy === "lockstep" ? (config.version ?? null) : null;
  return {
    strategy,
    expected,
    ok: packages.every((r) => r.ok),
    packages,
  };
}

/** Human-readable diagnostics (APM `VersionAlignmentReport.error_messages`). */
export function versionAlignmentErrorMessages(report: VersionAlignmentReport): string[] {
  const msgs: string[] = [];
  for (const row of report.packages) {
    if (row.ok) continue;
    if (row.reason === "missing_version") {
      msgs.push(`${row.path}: missing 'version' in apm.yml/bapm.yml`);
    } else if (row.reason === "invalid_yaml") {
      msgs.push(`${row.path}: malformed YAML in preferred manifest (failed to parse)`);
    } else if (row.reason === "invalid_yaml_manifest") {
      msgs.push(
        `${row.path}: invalid apm.yml/bapm.yml (must be a regular file within the project)`,
      );
    } else if (row.reason === "no_apm_yml") {
      msgs.push(`${row.path}: no apm.yml/bapm.yml or plugin.json found`);
    } else if (row.reason === "invalid_plugin_json") {
      msgs.push(`${row.path}: malformed JSON in plugin.json (failed to parse)`);
    } else if (row.reason === "missing_plugin_version") {
      msgs.push(`${row.path}: missing 'version' in plugin.json`);
    } else if (row.reason === "invalid_plugin_version") {
      msgs.push(`${row.path}: invalid 'version' in plugin.json (must use printable ASCII)`);
    } else if (row.reason.startsWith("drift:expected=")) {
      const expected = row.reason.slice("drift:expected=".length);
      msgs.push(`${row.path}: expected ${expected}, found ${row.version} (does not match / drift)`);
    } else if (row.reason.startsWith("duplicate_tag:other=")) {
      const other = row.reason.slice("duplicate_tag:other=".length);
      msgs.push(`${row.path}: rendered tag collides with ${other}`);
    } else {
      msgs.push(`${row.path}: ${row.reason}`);
    }
  }
  return msgs;
}

/** Aliases for acceptance soft-resolve. */
export const checkMarketplaceVersionAlignment = checkVersionAlignment;
export const runVersionAlignmentCheck = checkVersionAlignment;
export const checkVersions = checkVersionAlignment;
