import {
  listPendingExecutablePackages,
  listUserExecutableGrants,
  persistUserExecutableGrant,
  type PendingExecutablePackage,
  type SaveUserExecutableGrantsOptions,
  type UserExecutableGrantEntry,
  type UserExecutableGrantList,
} from "@b-apm/core";
import type { LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type ApproveCliDeps = {
  name: string;
  manifestFile: string;
  /** Override `~/.bapm` (tests / embedders). */
  configRoot?: string;
  /** Injectable save for tests; defaults to core user-store. */
  saveGrant?: (opts: SaveUserExecutableGrantsOptions) => unknown;
};

export const APPROVE_EXECUTABLE_TYPES = ["mcp", "bin", "hook"] as const;
export type ApproveExecutableType = (typeof APPROVE_EXECUTABLE_TYPES)[number];

export function formatApproveHelp(deps: ApproveCliDeps): string {
  return `${deps.name} approve — Persist user-local executable allow / inspect grants

Usage:
  bapm approve <package-name> [--bin|--hook|--mcp] [--user]
  bapm approve --list [--json]
  bapm approve --pending [--json]

Persists an allow grant under ~/.bapm/config.json (executables.allow).
  --mcp    approve MCP servers (default)
  --bin    approve dependency bin/ executables
  --hook   approve dependency hooks
Multiple type flags persist each selected type. With no type flag, approve
defaults to --mcp (backward compatible).
Interactive approve NEVER writes project ${deps.manifestFile}.

Read-only inspection:
  --list     Show user-local grants (package, types, allow/deny, source)
  --pending  Scan the manifest/lock for dependency MCP/bin/hook packages that
             are neither allowed nor denied in project/user/org grants
  --json     Machine-readable output for --list / --pending

Both views are read-only: no lock, manifest, module, or config writes.
`;
}

export function parseApproveArgs(argv: string[]): {
  help: boolean;
  packageName?: string;
  user: boolean;
  executableTypes: ApproveExecutableType[];
  list: boolean;
  pending: boolean;
  json: boolean;
} {
  let help = false;
  let list = false;
  let pending = false;
  let json = false;
  const positionals: string[] = [];
  const executableTypes: ApproveExecutableType[] = [];
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--list") {
      list = true;
      continue;
    }
    if (arg === "--pending") {
      pending = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--user") {
      // Interactive path is always user-local (sc-010); flag accepted for APM parity.
      continue;
    }
    if (arg === "--mcp" || arg === "--bin" || arg === "--hook") {
      const type = arg.slice(2) as ApproveExecutableType;
      if (!executableTypes.includes(type)) executableTypes.push(type);
      continue;
    }
    if (arg.startsWith("-")) continue;
    positionals.push(arg);
  }
  return {
    help,
    packageName: positionals[0],
    user: true,
    executableTypes: executableTypes.length > 0 ? executableTypes : ["mcp"],
    list,
    pending,
    json,
  };
}

function printGrantTable(result: UserExecutableGrantList): void {
  if (result.grants.length === 0) {
    console.log(`(no user executable grants in ${result.path})`);
    return;
  }
  const headers = ["PACKAGE", "GRANT", "TYPES", "SOURCE"];
  const body = result.grants.map((row: UserExecutableGrantEntry) => [
    row.package,
    row.grant,
    row.types.join(",") || "-",
    row.source,
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

function printPendingTable(rows: PendingExecutablePackage[]): void {
  if (rows.length === 0) {
    console.log("(no pending executable packages)");
    return;
  }
  const headers = ["PACKAGE", "TYPES", "REASON"];
  const body = rows.map((row) => [row.package, row.types.join(","), row.reason]);
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

export async function runApproveCli(
  deps: ApproveCliDeps,
  options: { args?: string[]; cwd?: string } = {},
): Promise<LifecycleResult> {
  const parsed = parseApproveArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatApproveHelp(deps));
    return { ok: true, exitCode: 0 };
  }

  const packageName = parsed.packageName?.trim();

  if (parsed.list && parsed.pending) {
    const message = "approve accepts either --list or --pending, not both";
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
  if (parsed.json && !parsed.list && !parsed.pending) {
    const message = "--json is only supported with --list or --pending";
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
  if ((parsed.list || parsed.pending) && packageName) {
    const message = "--list/--pending do not take a package name";
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }

  const storeOptions = deps.configRoot ? { configRoot: deps.configRoot } : {};

  if (parsed.list) {
    const result = listUserExecutableGrants(storeOptions);
    if (parsed.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printGrantTable(result);
    }
    return { ok: true, exitCode: 0 };
  }

  if (parsed.pending) {
    const result = listPendingExecutablePackages({
      cwd: options.cwd,
      ...storeOptions,
    });
    if (parsed.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printPendingTable(result.pending);
    }
    return { ok: true, exitCode: 0 };
  }

  if (!packageName) {
    console.error(`${deps.name}: approve requires a package name`);
    console.log(formatApproveHelp(deps));
    return { ok: false, exitCode: 1 };
  }

  const save = deps.saveGrant ?? persistUserExecutableGrant;
  for (const executableType of parsed.executableTypes) {
    save({
      packageName,
      grant: "allow",
      executableType,
    });
  }
  console.log(
    `Approved "${packageName}" (${parsed.executableTypes.join(", ")}) in user config (~/.bapm/config.json)`,
  );
  return { ok: true, exitCode: 0 };
}
