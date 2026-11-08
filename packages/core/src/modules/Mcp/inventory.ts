import { resolve } from "node:path";
import {
  loadUserExecutableGrants,
  parseExecutableGrants,
  resolveExecutableTrust,
  type ExecutableGrantSurface,
} from "@/modules/ExecutableTrust";
import { loadEffectiveLockfileOrNull, type LockfileDocument } from "@/modules/Lockfile";
import { loadManifest, ManifestError, type BapmManifest } from "@/modules/Manifest";
import { parseMcpDeclarations, type ParsedMcpDeclaration } from "./parse.ts";

type UnknownRecord = Record<string, unknown>;

export type McpApprovalState = "direct" | "allow" | "deny" | "withhold" | "skip";

/** Target host that has a server in its MCP config. */
export type McpInventoryTarget = {
  targetId: string;
  /** Config path recorded in `mcp_configs` / provenance, when known. */
  path: string | null;
};

/** Stable summary row used by `bapm mcp list` / `search --json`. */
export type McpServerSummary = {
  name: string;
  /** Owning package from the lock (`root`/manifest name for direct servers). */
  package: string | null;
  origin: "direct" | "dependency";
  transport: string | null;
  command: string | null;
  args: string[] | null;
  url: string | null;
  env: Record<string, string> | null;
  headers: Record<string, string> | null;
  targets: McpInventoryTarget[];
  /** Provenance / first target config path. */
  configPath: string | null;
  /** Which source supplied the visible fields; lock wins over manifest. */
  source: "lock" | "manifest";
  /** Resolved trust state; `direct` for root-owned declarations. */
  approval: McpApprovalState | null;
  withheld: boolean;
  /** Present in an optional `mcp_omissions` lock bag. */
  omitted: boolean;
};

/** `bapm mcp show` payload: summary + authored / locked source objects. */
export type McpServerDetails = McpServerSummary & {
  declaration: UnknownRecord | null;
  lockEntry: UnknownRecord | null;
  lockPath: string | null;
  manifestPath: string | null;
};

export type McpInventoryOptions = {
  cwd?: string;
  /** Override user config root (defaults to `~/.bapm`). */
  configRoot?: string;
};

export type McpInventoryResult = {
  servers: McpServerSummary[];
  lockPath: string | null;
  manifestPath: string | null;
};

export type McpShowResult =
  | { ok: true; server: McpServerDetails }
  | { ok: false; error: string; name: string; available: string[] };

export type McpSearchResult = McpInventoryResult & { query: string };

type ReadInventory = {
  servers: McpServerDetails[];
  lockPath: string | null;
  manifestPath: string | null;
};

type TrustContext = {
  projectSurface: ExecutableGrantSurface;
  userSurface: { present: boolean; allow: UnknownRecord; deny: UnknownRecord };
  rootName: string | null;
};

/**
 * Read the project's MCP inventory from the effective lock (`mcp_servers`,
 * `mcp_configs`, `mcp_target_servers`, `mcp_config_provenance`) plus direct
 * `dependencies.mcp` declarations. Read-only: no network, no writes.
 */
export function listMcpInventory(options: McpInventoryOptions = {}): McpInventoryResult {
  const { servers, lockPath, manifestPath } = readInventory(options);
  return {
    servers: servers.map(toSummary),
    lockPath,
    manifestPath,
  };
}

/** Details for one server by exact name. Unknown names return `ok: false`. */
export function showMcpServer(options: McpInventoryOptions & { name: string }): McpShowResult {
  const name = String(options.name ?? "").trim();
  const { servers } = readInventory(options);
  const server = servers.find((entry) => entry.name === name);
  if (!server) {
    return {
      ok: false,
      error: `MCP server "${name}" not found`,
      name,
      available: servers.map((entry) => entry.name),
    };
  }
  return { ok: true, server };
}

/**
 * Offline substring search over the same inventory (name, package, transport,
 * command, URL, target ids). This is deliberately not a registry lookup.
 */
export function searchMcpInventory(
  options: McpInventoryOptions & { query: string },
): McpSearchResult {
  const query = String(options.query ?? "").trim();
  const needle = query.toLowerCase();
  const { servers, lockPath, manifestPath } = readInventory(options);
  const matched =
    needle === "" ? servers : servers.filter((entry) => searchHaystack(entry).includes(needle));
  return {
    query,
    servers: matched.map(toSummary),
    lockPath,
    manifestPath,
  };
}

function readInventory(options: McpInventoryOptions): ReadInventory {
  const cwd = resolve(options.cwd ?? process.cwd());
  const lock = loadEffectiveLockfileOrNull({ cwd });
  const manifest = tryLoadManifest(cwd);
  const doc = (lock?.document ?? null) as (LockfileDocument & UnknownRecord) | null;
  const manifestDoc = manifest?.document ?? null;

  const lockServers = asRecord(doc?.mcp_servers);
  const lockConfigs = asRecord(doc?.mcp_configs);
  const lockTargetServers = asRecord(doc?.mcp_target_servers);
  const provenance = asRecord(doc?.mcp_config_provenance);
  const omissions = readOmissions(doc);

  const declarations = manifestDoc ? parseMcpDeclarations(manifestDoc.dependencies?.mcp) : [];
  const declarationByName = new Map<string, ParsedMcpDeclaration>();
  for (const declaration of declarations) {
    if (!declarationByName.has(declaration.name)) {
      declarationByName.set(declaration.name, declaration);
    }
  }

  const trust = buildTrustContext(manifestDoc, options.configRoot);
  const names = new Set<string>([...Object.keys(lockServers), ...declarationByName.keys()]);

  const servers: McpServerDetails[] = [];
  for (const name of names) {
    const declaration = declarationByName.get(name) ?? null;
    const lockRaw = lockServers[name];
    const lockEntry =
      lockRaw && typeof lockRaw === "object" && !Array.isArray(lockRaw)
        ? (lockRaw as UnknownRecord)
        : null;
    const packageFromLock = stringOrNull(lockEntry?.package);
    const packageName = packageFromLock ?? (declaration ? trust.rootName : null);
    const origin: McpServerSummary["origin"] =
      packageName !== null && trust.rootName !== null
        ? packageName === trust.rootName
          ? "direct"
          : "dependency"
        : packageFromLock === null
          ? "direct"
          : "dependency";

    const targets = targetConfigsFor(name, lockConfigs, lockTargetServers);
    const provenanceEntry = asRecord(provenance[name]);
    const configPath = stringOrNull(provenanceEntry.path) ?? targets[0]?.path ?? null;

    const command = pickString(lockEntry, declaration, "command");
    const url = pickString(lockEntry, declaration, "url");
    const transport = normalizeTransport(
      pickString(lockEntry, declaration, "transport") ?? pickString(lockEntry, declaration, "type"),
      command,
      url,
    );

    const omittedEntry =
      omissions.get(name) ?? (packageName !== null ? omissions.get(packageName) : undefined);
    const omitted = omittedEntry !== undefined;
    const trustState = resolveApproval({
      origin,
      packageName,
      trust,
      omitted,
    });

    servers.push({
      name,
      package: packageName,
      origin,
      transport,
      command,
      args: pickArgs(lockEntry, declaration),
      url,
      env: pickStringMap(lockEntry, declaration, "env"),
      headers: pickStringMap(lockEntry, declaration, "headers"),
      targets,
      configPath,
      source: lockEntry ? "lock" : "manifest",
      approval: trustState.approval,
      withheld: trustState.withheld,
      omitted,
      declaration: declaration ? declaration.raw : null,
      lockEntry,
      lockPath: lock?.sourcePath ?? null,
      manifestPath: manifest?.sourcePath ?? null,
    });
  }

  servers.sort((a, b) => a.name.localeCompare(b.name));
  return {
    servers,
    lockPath: lock?.sourcePath ?? null,
    manifestPath: manifest?.sourcePath ?? null,
  };
}

function toSummary(server: McpServerDetails): McpServerSummary {
  const {
    declaration: _declaration,
    lockEntry: _lockEntry,
    lockPath: _lockPath,
    manifestPath: _manifestPath,
    ...summary
  } = server;
  return summary;
}

function tryLoadManifest(cwd: string): { document: BapmManifest; sourcePath: string } | null {
  try {
    const loaded = loadManifest({ cwd });
    return { document: loaded.document, sourcePath: loaded.sourcePath };
  } catch (error) {
    if (
      error instanceof ManifestError &&
      (error.code === "MANIFEST_NOT_FOUND" || error.code === "MANIFEST_MISSING_FILE")
    ) {
      return null;
    }
    throw error;
  }
}

function buildTrustContext(
  manifestDoc: BapmManifest | null,
  configRoot: string | undefined,
): TrustContext {
  const user = loadUserExecutableGrants(configRoot !== undefined ? { configRoot } : {});
  return {
    projectSurface: manifestDoc
      ? parseExecutableGrants({ manifest: manifestDoc as UnknownRecord })
      : parseExecutableGrants({}),
    userSurface: {
      present: user.present,
      allow: user.allow,
      deny: user.deny,
    },
    rootName: manifestDoc ? stringOrNull(manifestDoc.name) : null,
  };
}

function resolveApproval(args: {
  origin: McpServerSummary["origin"];
  packageName: string | null;
  trust: TrustContext;
  omitted: boolean;
}): { approval: McpApprovalState; withheld: boolean } {
  if (args.origin === "direct") {
    return { approval: "direct", withheld: args.omitted };
  }
  if (args.packageName === null) {
    return { approval: args.omitted ? "withhold" : "skip", withheld: args.omitted };
  }
  const decision = resolveExecutableTrust({
    packageName: args.packageName,
    executableType: "mcp",
    projectSurface: args.trust.projectSurface,
    userSurface: args.trust.userSurface,
  });
  const approval: McpApprovalState =
    decision.outcome === "allow" ||
    decision.outcome === "deny" ||
    decision.outcome === "withhold" ||
    decision.outcome === "skip"
      ? decision.outcome
      : "skip";
  return {
    approval: args.omitted && approval !== "deny" ? "withhold" : approval,
    withheld: args.omitted || decision.outcome === "deny" || decision.outcome === "withhold",
  };
}

function targetConfigsFor(
  name: string,
  configs: UnknownRecord,
  targetServers: UnknownRecord,
): McpInventoryTarget[] {
  const out = new Map<string, McpInventoryTarget>();
  for (const [targetId, raw] of Object.entries(configs)) {
    const config = asRecord(raw);
    if (!Array.isArray(config.servers)) continue;
    if (!config.servers.includes(name)) continue;
    out.set(targetId, { targetId, path: stringOrNull(config.path) });
  }
  for (const [targetId, raw] of Object.entries(targetServers)) {
    if (!Array.isArray(raw) || !raw.includes(name)) continue;
    const existing = out.get(targetId);
    out.set(targetId, {
      targetId,
      path: existing?.path ?? stringOrNull(asRecord(configs[targetId]).path),
    });
  }
  return [...out.values()].sort((a, b) => a.targetId.localeCompare(b.targetId));
}

function readOmissions(doc: (LockfileDocument & UnknownRecord) | null): Map<string, unknown> {
  const raw = doc?.mcp_omissions;
  const out = new Map<string, unknown>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string" && item.trim() !== "") {
        out.set(item.trim(), true);
        continue;
      }
      const record = asRecord(item);
      const name = stringOrNull(record.name);
      if (name) out.set(name, item);
    }
    return out;
  }
  for (const [name, reason] of Object.entries(asRecord(raw))) {
    out.set(name, reason);
  }
  return out;
}

function searchHaystack(server: McpServerDetails): string {
  return [
    server.name,
    server.package ?? "",
    server.transport ?? "",
    server.command ?? "",
    server.url ?? "",
    server.configPath ?? "",
    ...server.targets.map((target) => target.targetId),
  ]
    .join("\n")
    .toLowerCase();
}

function pickString(
  lockEntry: UnknownRecord | null,
  declaration: ParsedMcpDeclaration | null,
  key: "command" | "url" | "transport" | "type",
): string | null {
  return stringOrNull(lockEntry?.[key]) ?? stringOrNull(declaration?.[key]);
}

function pickArgs(
  lockEntry: UnknownRecord | null,
  declaration: ParsedMcpDeclaration | null,
): string[] | null {
  const value = lockEntry?.args ?? declaration?.args;
  if (!Array.isArray(value)) return null;
  return value.map((item) => String(item));
}

function pickStringMap(
  lockEntry: UnknownRecord | null,
  declaration: ParsedMcpDeclaration | null,
  key: "env" | "headers",
): Record<string, string> | null {
  const raw = asRecord(lockEntry?.[key] ?? declaration?.[key]);
  const entries = Object.entries(raw);
  if (entries.length === 0) return null;
  return Object.fromEntries(entries.map(([name, value]) => [name, String(value)]));
}

function normalizeTransport(
  declared: string | null,
  command: string | null,
  url: string | null,
): string | null {
  if (declared !== null) return declared.trim().toLowerCase();
  if (command !== null) return "stdio";
  if (url !== null) return "http";
  return null;
}

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
