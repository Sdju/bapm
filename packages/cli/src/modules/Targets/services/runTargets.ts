import { ManifestError, loadBaseManifest, loadManifest, resolveActive } from "@b-apm/core";
import type { IntegrationRegistry } from "@b-apm/integration-api";
import {
  createCliIntegrationRegistry,
  registerManifestIntegrationsFromCwd,
} from "@/modules/Integrations";
import { readConfiguredTarget } from "@/modules/Config";
import { CANONICAL_HOST_IDS } from "@/common/canonicalHosts.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type TargetsCliDeps = LifecycleCliDeps;

export type TargetsOptions = { args?: string[]; cwd?: string };

export type ParsedTargetsArgs = {
  json: boolean;
  all: boolean;
  help?: boolean;
  error?: string;
};

export type TargetRow = {
  target: string;
  id: string;
  status: "active" | "detected" | "inactive";
  active: boolean;
  detected: boolean;
  registered: boolean;
  source: "manifest" | "local_overlay" | "config" | "detect" | null;
  deployRoots: string[];
  mcpScope: "project" | "home" | null;
  compile: boolean;
};

export function formatTargetsHelp(deps: TargetsCliDeps): string {
  return `${deps.name} targets — Inspect registered host targets (read-only)

Usage:
  bapm targets [--json] [--all]

Options:
  --json       Stable machine-readable output
  --all        Include known canonical hosts without a registered integration
  --help, -h   Show this help

Columns:
  TARGET       Registered integration id
  STATUS       active | detected | inactive
  SOURCE       local_overlay | manifest | config | detect (when active)
  DEPLOY ROOTS deployRoots declared by the integration
  MCP          project | home (target configureMcp scope)
  COMPILE      whether the target implements compile()

Notes:
  Read-only: no host files, lockfile, or config are written.
  Active mirrors install selection: --target is not accepted here; manifest active
  (including bapm.local.yml) wins over the user config target, then sole detect.
`;
}

export function parseTargetsArgs(argv: string[]): ParsedTargetsArgs {
  let json = false;
  let all = false;
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { json, all, help: true };
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg.startsWith("-")) return { json, all, error: `Unknown targets flag: ${arg}` };
    return { json, all, error: `Unexpected targets argument: ${arg}` };
  }
  return { json, all };
}

function manifestActiveState(cwd: string): {
  ids: string[];
  source: "manifest" | "local_overlay";
} {
  try {
    const effective = loadManifest({ cwd });
    const ids = resolveActive(effective.document).targetIds;
    if (ids.length === 0) return { ids, source: "manifest" };
    if (effective.localPath) {
      try {
        const baseIds = resolveActive(loadBaseManifest({ cwd }).document).targetIds;
        if (JSON.stringify(baseIds) !== JSON.stringify(ids)) {
          return { ids, source: "local_overlay" };
        }
      } catch {
        // Effective manifest already loaded; keep the manifest source.
      }
    }
    return { ids, source: "manifest" };
  } catch (error) {
    if (
      error instanceof ManifestError &&
      (error.code === "MANIFEST_NOT_FOUND" || error.code === "MANIFEST_MISSING_FILE")
    ) {
      return { ids: [], source: "manifest" };
    }
    throw error;
  }
}

function resolveActiveState(args: {
  manifestActive: string[];
  manifestSource: "manifest" | "local_overlay";
  configuredTarget?: string;
  detectedIds: string[];
}): { activeIds: Set<string>; source: TargetRow["source"] } {
  if (args.manifestActive.length > 0) {
    return { activeIds: new Set(args.manifestActive), source: args.manifestSource };
  }
  if (args.configuredTarget) {
    return { activeIds: new Set([args.configuredTarget]), source: "config" };
  }
  if (args.detectedIds.length === 1) {
    return { activeIds: new Set(args.detectedIds), source: "detect" };
  }
  return { activeIds: new Set(), source: null };
}

function targetRows(args: {
  registry: IntegrationRegistry;
  detectedIds: string[];
  activeIds: Set<string>;
  activeSource: TargetRow["source"];
  all: boolean;
  configuredTarget?: string;
}): TargetRow[] {
  const rows: TargetRow[] = [];
  const seen = new Set<string>();

  for (const target of args.registry.list()) {
    const id = String(target.id);
    seen.add(id);
    const active = args.activeIds.has(id);
    const detected = args.detectedIds.includes(id);
    rows.push({
      target: id,
      id,
      status: active ? "active" : detected ? "detected" : "inactive",
      active,
      detected,
      registered: true,
      source: active ? args.activeSource : null,
      deployRoots: [...target.deployRoots],
      mcpScope: target.mcpScope === "home" ? "home" : "project",
      compile: typeof target.compile === "function",
    });
  }

  if (args.all) {
    for (const id of CANONICAL_HOST_IDS) {
      if (seen.has(id)) continue;
      seen.add(id);
      const active = args.activeIds.has(id);
      rows.push({
        target: id,
        id,
        status: active ? "active" : "inactive",
        active,
        detected: false,
        registered: false,
        source: active ? args.activeSource : null,
        deployRoots: [],
        mcpScope: null,
        compile: false,
      });
    }
    const configured = args.configuredTarget?.trim();
    if (configured && !seen.has(configured)) {
      rows.push({
        target: configured,
        id: configured,
        status: args.activeIds.has(configured) ? "active" : "inactive",
        active: args.activeIds.has(configured),
        detected: false,
        registered: false,
        source: args.activeIds.has(configured) ? args.activeSource : null,
        deployRoots: [],
        mcpScope: null,
        compile: false,
      });
    }
  }

  rows.sort((a, b) => a.target.localeCompare(b.target));
  return rows;
}

function printTable(rows: TargetRow[]): void {
  const headers = ["TARGET", "STATUS", "SOURCE", "DEPLOY ROOTS", "MCP", "COMPILE"];
  const body = rows.map((row) => [
    row.target,
    row.status,
    row.source ?? "",
    row.deployRoots.join(",") || (row.registered ? "(none)" : "-"),
    row.mcpScope ?? "-",
    row.compile ? "yes" : "no",
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...body.map((cells) => cells[index]!.length)),
  );
  const render = (cells: string[]) =>
    cells
      .map((cell, index) => cell.padEnd(widths[index]!))
      .join("  ")
      .trimEnd();
  console.log(render(headers));
  console.log(render(widths.map((width) => "-".repeat(width))));
  for (const cells of body) console.log(render(cells));
}

export async function runTargetsCli(
  deps: TargetsCliDeps,
  options: TargetsOptions = {},
): Promise<LifecycleResult> {
  const parsed = parseTargetsArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatTargetsHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }

  const cwd = options.cwd ?? process.cwd();
  try {
    const registry = createCliIntegrationRegistry();
    await registerManifestIntegrationsFromCwd(registry, cwd);
    const manifestActive = manifestActiveState(cwd);
    const configuredTarget = readConfiguredTarget();
    const detection = await registry.detect(cwd);
    const state = resolveActiveState({
      manifestActive: manifestActive.ids,
      manifestSource: manifestActive.source,
      configuredTarget,
      detectedIds: detection.detectedIds,
    });
    const rows = targetRows({
      registry,
      detectedIds: detection.detectedIds,
      activeIds: state.activeIds,
      activeSource: state.source,
      all: parsed.all,
      configuredTarget,
    });

    if (parsed.json) {
      console.log(JSON.stringify(rows, null, 2));
      return { ok: true, exitCode: 0 };
    }
    if (rows.length === 0) {
      console.log(`${deps.name}: no registered targets for this project`);
      console.log(
        "Install a host integration (npm i -D @b-apm/integration-<id>) or declare targets: in the manifest.",
      );
      return { ok: true, exitCode: 0 };
    }
    printTable(rows);
    return { ok: true, exitCode: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
