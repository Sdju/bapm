import { createInterface } from "node:readline";
import {
  listPendingExecutablePackages,
  listUserExecutableGrants,
  persistUserExecutableGrant,
  userConfigJsonPath,
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
  /** Injectable interactive confirmation (tests / embedders). */
  confirm?: (message: string) => Promise<boolean>;
  /** Override TTY detection for the `--all` confirmation gate. */
  isTTY?: () => boolean;
};

export const APPROVE_EXECUTABLE_TYPES = ["mcp", "bin", "hook"] as const;
export type ApproveExecutableType = (typeof APPROVE_EXECUTABLE_TYPES)[number];

export type ApproveAllPlanItem = {
  package: string;
  types: ApproveExecutableType[];
};

export type ApproveAllPlanJson = {
  mode: "all" | "recommended";
  wrote: boolean;
  configPath: string;
  lockfile: string | null;
  manifest: string | null;
  plan: ApproveAllPlanItem[];
};

export function formatApproveHelp(deps: ApproveCliDeps): string {
  return `${deps.name} approve — Persist user-local executable allow / inspect grants

Usage:
  bapm approve <package-name> [--bin|--hook|--mcp] [--user]
  bapm approve --all [--recommended] [-y|--yes] [--json]
  bapm approve --list [--json]
  bapm approve --pending [--json]

Persists an allow grant under ~/.bapm/config.json (executables.allow).
  --mcp    approve MCP servers (default)
  --bin    approve dependency bin/ executables
  --hook   approve dependency hooks
Multiple type flags persist each selected type. With no type flag, approve
defaults to --mcp (backward compatible).
Interactive approve NEVER writes project ${deps.manifestFile}.

Approve all currently pending executable packages:
  --all          Approve every package/type reported by --pending (mcp, bin, hook)
  --recommended  Alias for --all for now (identical behavior; documented subset later)
  -y, --yes      Required to write in non-interactive sessions (pipes / CI)
Without -y, a TTY session prompts before writing. --json prints the plan only
unless -y is also passed; there are no implicit writes.

Read-only inspection:
  --list     Show user-local grants (package, types, allow/deny, source)
  --pending  Scan the manifest/lock for dependency MCP/bin/hook packages that
             are neither allowed nor denied in project/user/org grants
  --json     Machine-readable output for --list / --pending / --all

The inspection views are read-only: no lock, manifest, module, or config writes.
`;
}

export function parseApproveArgs(argv: string[]): {
  help: boolean;
  packageName?: string;
  user: boolean;
  executableTypes: ApproveExecutableType[];
  list: boolean;
  pending: boolean;
  all: boolean;
  recommended: boolean;
  yes: boolean;
  json: boolean;
} {
  let help = false;
  let list = false;
  let pending = false;
  let all = false;
  let recommended = false;
  let yes = false;
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
    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg === "--recommended") {
      recommended = true;
      all = true;
      continue;
    }
    if (arg === "-y" || arg === "--yes") {
      yes = true;
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
    all,
    recommended,
    yes,
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

function printApprovePlanTable(plan: ApproveAllPlanItem[]): void {
  const headers = ["PACKAGE", "TYPES"];
  const body = plan.map((row) => [row.package, row.types.join(",") || "-"]);
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

async function promptConfirm(message: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(message, resolve);
    });
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
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
  if (parsed.all && (parsed.list || parsed.pending)) {
    const message = "approve --all/--recommended cannot be combined with --list or --pending";
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
  if (parsed.all && packageName) {
    const message = "approve --all/--recommended does not take a package name";
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
  if (parsed.yes && !parsed.all) {
    const message = "-y/--yes is only supported with --all/--recommended";
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
  if (parsed.json && !parsed.list && !parsed.pending && !parsed.all) {
    const message = "--json is only supported with --list, --pending, or --all";
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

  if (parsed.all) {
    return runApproveAll(deps, {
      cwd: options.cwd,
      json: parsed.json,
      yes: parsed.yes,
      mode: parsed.recommended ? "recommended" : "all",
      storeOptions,
    });
  }

  if (!packageName) {
    console.error(`${deps.name}: approve requires a package name`);
    console.log(formatApproveHelp(deps));
    return { ok: false, exitCode: 1 };
  }

  const save = deps.saveGrant ?? persistUserExecutableGrant;
  for (const executableType of parsed.executableTypes) {
    save({
      ...storeOptions,
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

async function runApproveAll(
  deps: ApproveCliDeps,
  options: {
    cwd?: string;
    json: boolean;
    yes: boolean;
    mode: "all" | "recommended";
    storeOptions: { configRoot?: string };
  },
): Promise<LifecycleResult> {
  const configPath = userConfigJsonPath(options.storeOptions);
  const pending = listPendingExecutablePackages({
    cwd: options.cwd,
    ...options.storeOptions,
  });
  const plan: ApproveAllPlanItem[] = pending.pending.map((row) => ({
    package: row.package,
    types: [...row.types],
  }));
  const payload: ApproveAllPlanJson = {
    mode: options.mode,
    wrote: false,
    configPath,
    lockfile: pending.lockfile,
    manifest: pending.manifest,
    plan,
  };

  if (plan.length === 0) {
    if (options.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log("(no pending executable packages; nothing to approve)");
    }
    return { ok: true, exitCode: 0 };
  }

  if (options.json && !options.yes) {
    // JSON without -y is an explicit plan / dry run: never write implicitly.
    console.log(JSON.stringify(payload, null, 2));
    return { ok: true, exitCode: 0 };
  }

  if (!options.json) {
    console.log(`Pending executable packages to approve in user config (${configPath}):`);
    printApprovePlanTable(plan);
  }

  if (!options.yes) {
    const interactive = deps.isTTY ? deps.isTTY() : Boolean(process.stdin.isTTY);
    if (!interactive) {
      const message = "Non-interactive approve --all requires -y/--yes (no grants written)";
      console.error(`${deps.name}: ${message}`);
      return { ok: false, exitCode: 1, message };
    }
    const confirm = deps.confirm ?? promptConfirm;
    const grantCount = plan.reduce((total, row) => total + row.types.length, 0);
    const confirmed = await confirm(
      `Approve ${plan.length} package(s) / ${grantCount} grant(s) in ${configPath}? [y/N] `,
    );
    if (!confirmed) {
      const message = "approve aborted; no grants written";
      console.error(`${deps.name}: ${message}`);
      return { ok: false, exitCode: 1, message };
    }
  }

  const save = deps.saveGrant ?? persistUserExecutableGrant;
  let grantCount = 0;
  for (const item of plan) {
    for (const executableType of item.types) {
      save({
        ...options.storeOptions,
        packageName: item.package,
        grant: "allow",
        executableType,
      });
      grantCount += 1;
    }
  }

  if (options.json) {
    console.log(JSON.stringify({ ...payload, wrote: true }, null, 2));
  } else {
    console.log(
      `Approved ${plan.length} package(s) (${grantCount} grant(s)) in user config (${configPath})`,
    );
  }
  return { ok: true, exitCode: 0 };
}
