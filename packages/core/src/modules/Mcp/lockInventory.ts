import type { LockfileDocument } from "@/modules/Lockfile";
import type { ApplyMcpInventoryOptions, ScrubMcpInventoryOptions } from "./types.ts";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

/**
 * Populate lock top-level `mcp_*` fields from configured servers.
 * Preserves unknown / `x-*` keys already on the document.
 *
 * Without `targetId` + `configPath`, only `mcp_servers` (and provenance for the
 * current servers) is refreshed; existing target inventory is left untouched.
 * Passing an empty `servers` list therefore scrubs stale server declarations
 * without inventing a target entry.
 *
 * Maps are built with `Map` + `Object.fromEntries` so server names such as
 * `toString` / `constructor` never resolve through `Object.prototype`.
 */
export function applyMcpInventoryToLock(options: ApplyMcpInventoryOptions): LockfileDocument {
  const doc = options.document as LockfileDocument & Record<string, unknown>;
  const servers = options.servers;
  const names = servers.map((s) => s.name).filter(Boolean);

  const byName = new Map<string, UnknownRecord>();
  for (const s of servers) {
    if (!s.name) continue;
    byName.set(s.name, {
      name: s.name,
      package: s.packageName,
      ...Object.fromEntries(
        Object.entries(s).filter(([k]) => k !== "name" && k !== "packageName" && k !== "origin"),
      ),
    });
  }

  // Keep the existing key order for names that survive; append newly authored ones.
  const orderedNames: string[] = [];
  for (const name of Object.keys(asRecord(doc.mcp_servers))) {
    if (byName.has(name)) orderedNames.push(name);
  }
  for (const name of byName.keys()) {
    if (!orderedNames.includes(name)) orderedNames.push(name);
  }

  doc.mcp_servers = Object.fromEntries(orderedNames.map((name) => [name, byName.get(name)]));

  const targetId = typeof options.targetId === "string" ? options.targetId.trim() : "";
  const configPath = typeof options.configPath === "string" ? options.configPath.trim() : "";
  const configuredTargets: Array<{ targetId: string; configPath: string }> = [];
  if (targetId !== "" && configPath !== "") {
    configuredTargets.push({ targetId, configPath });
  }
  for (const target of options.targets ?? []) {
    const id = typeof target.targetId === "string" ? target.targetId.trim() : "";
    const path = typeof target.configPath === "string" ? target.configPath.trim() : "";
    if (id === "" || path === "") continue;
    if (configuredTargets.some((existing) => existing.targetId === id)) continue;
    configuredTargets.push({ targetId: id, configPath: path });
  }
  const targetConfigured = configuredTargets.length > 0;

  if (targetConfigured) {
    const configs = new Map<string, unknown>(Object.entries(asRecord(doc.mcp_configs)));
    const targetServers = new Map<string, unknown>(
      Object.entries(asRecord(doc.mcp_target_servers)),
    );
    for (const target of configuredTargets) {
      configs.set(target.targetId, {
        path: target.configPath,
        // Fresh array — shared refs cause YAML anchors rejected by safe-subset load.
        servers: [...names],
      });
      targetServers.set(target.targetId, [...names]);
    }
    doc.mcp_configs = Object.fromEntries(configs);
    doc.mcp_target_servers = Object.fromEntries(targetServers);
  }

  const provenance = new Map<string, unknown>(Object.entries(asRecord(doc.mcp_config_provenance)));
  if (targetConfigured) {
    // Provenance records a single path per server; with multiple targets the
    // last configured one wins, matching the historical single-target field.
    const lastConfigPath = configuredTargets[configuredTargets.length - 1]!.configPath;
    for (const s of servers) {
      if (!s.name) continue;
      provenance.set(s.name, {
        package: s.packageName,
        path: lastConfigPath,
      });
    }
  }
  // Drop provenance for servers no longer in the authored inventory.
  const keep = new Set(names);
  for (const name of provenance.keys()) {
    if (!keep.has(name)) provenance.delete(name);
  }
  doc.mcp_config_provenance = Object.fromEntries(provenance);

  return doc;
}

/**
 * Remove stale servers from the lock inventory while preserving entries owned by
 * dependency packages that may simply not have been collected this run (for
 * example when transitive MCP trust is off).
 *
 * Root-owned entries (matching `rootPackageName`, or with no recorded package)
 * are always removed. Dependency-owned entries survive unless `livePackageNames`
 * is non-empty and the owning package is absent from the current resolution.
 */
export function scrubMcpInventory(options: ScrubMcpInventoryOptions): LockfileDocument {
  const doc = options.document as LockfileDocument & Record<string, unknown>;

  if (options.all === true) {
    doc.mcp_servers = {};
    doc.mcp_configs = {};
    doc.mcp_target_servers = {};
    doc.mcp_config_provenance = {};
    return doc;
  }

  const rootPackageName = (options.rootPackageName ?? "").trim();
  const livePackageNames =
    options.livePackageNames && options.livePackageNames.length > 0
      ? new Set(options.livePackageNames)
      : undefined;

  const keptServers = new Map<string, unknown>();
  const removed = new Set<string>();
  for (const [name, raw] of Object.entries(asRecord(doc.mcp_servers))) {
    const entry = asRecord(raw);
    const packageName = typeof entry.package === "string" ? entry.package.trim() : "";
    const rootOwned =
      packageName === "" || (rootPackageName !== "" && packageName === rootPackageName);
    const liveDependency =
      !rootOwned && (livePackageNames === undefined || livePackageNames.has(packageName));
    if (liveDependency) keptServers.set(name, raw);
    else removed.add(name);
  }

  doc.mcp_servers = Object.fromEntries(keptServers);
  if (removed.size === 0) return doc;

  const provenance = new Map<string, unknown>(Object.entries(asRecord(doc.mcp_config_provenance)));
  for (const name of removed) provenance.delete(name);
  doc.mcp_config_provenance = Object.fromEntries(provenance);

  doc.mcp_configs = filterTargetConfigs(doc.mcp_configs, removed);
  doc.mcp_target_servers = filterTargetServerLists(doc.mcp_target_servers, removed);

  return doc;
}

function filterTargetConfigs(value: unknown, removed: Set<string>): UnknownRecord {
  const out: Array<[string, unknown]> = [];
  for (const [targetId, raw] of Object.entries(asRecord(value))) {
    const config = asRecord(raw);
    if (Array.isArray(config.servers)) {
      const servers = config.servers.filter(
        (name) => typeof name !== "string" || !removed.has(name),
      );
      if (servers.length === 0) continue;
      out.push([targetId, { ...config, servers }]);
      continue;
    }
    // Legacy server-keyed shape: drop entries for removed servers.
    if (removed.has(targetId)) continue;
    out.push([targetId, raw]);
  }
  return Object.fromEntries(out);
}

function filterTargetServerLists(value: unknown, removed: Set<string>): UnknownRecord {
  const out: Array<[string, unknown]> = [];
  for (const [targetId, raw] of Object.entries(asRecord(value))) {
    if (!Array.isArray(raw)) {
      if (removed.has(targetId)) continue;
      out.push([targetId, raw]);
      continue;
    }
    const servers = raw.filter((name) => typeof name !== "string" || !removed.has(name));
    if (servers.length === 0) continue;
    out.push([targetId, servers]);
  }
  return Object.fromEntries(out);
}
