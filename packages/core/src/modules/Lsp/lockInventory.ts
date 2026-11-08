import type { ApplyLspInventoryOptions, CollectedLspServer } from "./types.ts";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function serverConfig(server: CollectedLspServer): UnknownRecord {
  const {
    origin: _origin,
    packageName: _packageName,
    owner: _owner,
    raw: _raw,
    ...config
  } = server;
  void _origin;
  void _packageName;
  void _owner;
  void _raw;
  return { ...config, name: server.name };
}

/**
 * Populate lock top-level `lsp_*` fields from configured servers.
 * Preserves unknown / `x-*` keys already on the document.
 *
 * Empty input removes every LSP inventory bag so a project that deleted its
 * declarations does not keep stale inventory.
 */
export function applyLspInventoryToLock(options: ApplyLspInventoryOptions): UnknownRecord {
  const doc = options.document;
  const names = [...new Set(options.servers.map((server) => server.name).filter(Boolean))].sort();

  if (names.length === 0) {
    delete doc.lsp_servers;
    delete doc.lsp_configs;
    delete doc.lsp_target_servers;
    delete doc.lsp_config_provenance;
    return doc;
  }

  const byName = new Map<string, CollectedLspServer>();
  for (const server of options.servers) {
    if (server.name && !byName.has(server.name)) byName.set(server.name, server);
  }

  doc.lsp_servers = names;
  doc.lsp_configs = Object.fromEntries(
    names.map((name) => [name, serverConfig(byName.get(name)!)]),
  );
  doc.lsp_config_provenance = Object.fromEntries(
    names.map((name) => [name, byName.get(name)!.owner]),
  );

  if (options.targetServers !== undefined) {
    const targetServers: Record<string, string[]> = {};
    for (const [targetId, raw] of Object.entries(options.targetServers)) {
      const id = targetId.trim();
      if (!id) continue;
      const list = [
        ...new Set((raw ?? []).map((name) => String(name).trim()).filter(Boolean)),
      ].sort();
      if (list.length > 0) targetServers[id] = list;
    }
    if (Object.keys(targetServers).length > 0) {
      doc.lsp_target_servers = targetServers;
    } else {
      delete doc.lsp_target_servers;
    }
  }

  return doc;
}

/** Read the previously recorded target -> server-name ownership map. */
export function readLspTargetInventory(document?: UnknownRecord): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (!document) return out;
  const raw = asRecord(document.lsp_target_servers);
  for (const [targetId, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) continue;
    const names = value
      .filter((name): name is string => typeof name === "string" && name.length > 0)
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length > 0) out.set(targetId, [...new Set(names)]);
  }
  return out;
}
