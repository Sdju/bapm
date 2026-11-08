import { accessSync, constants, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type RuntimeName = "copilot" | "codex" | "gemini" | "llm";
export type RuntimeSource = "runtime" | "path";
export type RuntimeEnv = Record<string, string | undefined>;

export type RuntimeDescriptor = {
  readonly name: RuntimeName;
  readonly binary: string;
  readonly description: string;
  readonly preference: number;
};

/**
 * Canonical runtime descriptors, mirroring APM's `runtime list` preference
 * order (copilot -> codex -> gemini -> llm).
 */
export const RUNTIME_DESCRIPTORS: readonly RuntimeDescriptor[] = [
  {
    name: "copilot",
    binary: "copilot",
    description: "GitHub Copilot CLI",
    preference: 10,
  },
  {
    name: "codex",
    binary: "codex",
    description: "OpenAI Codex CLI",
    preference: 20,
  },
  {
    name: "gemini",
    binary: "gemini",
    description: "Google Gemini CLI",
    preference: 30,
  },
  {
    name: "llm",
    binary: "llm",
    description: "Simon Willison's LLM CLI",
    preference: 40,
  },
];

const RUNTIME_ORDER: readonly RuntimeName[] = RUNTIME_DESCRIPTORS.map((item) => item.name);

export type RuntimeRow = {
  name: RuntimeName;
  binary: string;
  description: string;
  preference: number;
  available: boolean;
  source: RuntimeSource | null;
  path: string | null;
  version: string | null;
};

export type RuntimeStatus = RuntimeRow & {
  active: boolean;
  preferenceOrder: RuntimeName[];
};

export type RuntimeSummary = {
  active: RuntimeName | null;
  preferenceOrder: RuntimeName[];
  runtimes: RuntimeRow[];
};

export type RuntimeDeps = LifecycleCliDeps & {
  /** Environment used for PATH/version lookups and BAPM_RUNTIME_DIR. */
  env?: RuntimeEnv;
  /** Override the home directory used to derive managed runtime dirs. */
  homeDir?: string;
  /** Override managed runtime dirs (tests / embedders). */
  runtimeDirs?: string[];
  /** Override regular-file detection for managed runtime binaries. */
  isFile?: (path: string) => boolean;
  /** Override PATH lookup (tests / embedders). */
  which?: (binary: string) => string | undefined;
  /** Override `--version` probing (tests avoid spawning binaries). */
  readVersion?: (binary: string, path: string) => string | null;
};

export type RuntimeOptions = { args?: string[]; cwd?: string };

export type ParsedRuntimeArgs =
  | { sub: "help" }
  | { sub: "list"; json: boolean }
  | { sub: "status"; name?: string; json: boolean }
  | { sub: "unsupported"; command: "setup" | "remove" }
  | { sub: "error"; message: string };

type Detector = {
  runtimeDirs: string[];
  isFile: (path: string) => boolean;
  which: (binary: string) => string | undefined;
  readVersion: (binary: string, path: string) => string | null;
};

export function formatRuntimeHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} runtime — Inspect AI runtime CLIs (read-only)

Usage:
  bapm runtime list [--json]
  bapm runtime status [NAME] [--json]
  bapm runtime setup RUNTIME   (not implemented)
  bapm runtime remove RUNTIME  (not implemented)

Options:
  --json       Stable machine-readable output
  --help, -h   Show this help

Runtimes (preference order):
  copilot -> codex -> gemini -> llm

Detection:
  Managed runtime dir first (BAPM_RUNTIME_DIR, ~/.bapm/runtimes, ~/.apm/runtimes),
  then PATH. Version is read with a short local \`--version\` probe.

Notes:
  Read-only: nothing is downloaded, installed, configured, or removed.
  \`setup\` and \`remove\` are deferred; use the runtime's upstream installer.
  Without NAME, \`status\` reports the preference order and active runtime.
`;
}

function errorResult(deps: LifecycleCliDeps, message: string): LifecycleResult {
  console.error(`${deps.name}: ${message}`);
  return { ok: false, exitCode: 1, message };
}

export function parseRuntimeArgs(argv: string[]): ParsedRuntimeArgs {
  const [sub, ...rest] = argv;
  if (!sub || sub === "help" || sub === "--help" || sub === "-h") {
    return { sub: "help" };
  }

  if (sub === "list") {
    let json = false;
    for (const arg of rest) {
      if (arg === "--json") {
        json = true;
        continue;
      }
      if (arg === "--help" || arg === "-h") return { sub: "help" };
      if (arg.startsWith("-")) {
        return { sub: "error", message: `Unknown runtime list flag: ${arg}` };
      }
      return { sub: "error", message: `Unexpected runtime list argument: ${arg}` };
    }
    return { sub: "list", json };
  }

  if (sub === "status") {
    let json = false;
    const positionals: string[] = [];
    for (const arg of rest) {
      if (arg === "--json") {
        json = true;
        continue;
      }
      if (arg === "--help" || arg === "-h") return { sub: "help" };
      if (arg.startsWith("-")) {
        return { sub: "error", message: `Unknown runtime status flag: ${arg}` };
      }
      positionals.push(arg);
    }
    if (positionals.length > 1) {
      return { sub: "error", message: "Usage: bapm runtime status [NAME] [--json]" };
    }
    const name = positionals[0];
    return name ? { sub: "status", name, json } : { sub: "status", json };
  }

  if (sub === "setup" || sub === "remove") {
    return { sub: "unsupported", command: sub };
  }

  return { sub: "error", message: `Unknown runtime subcommand: ${sub}` };
}

function defaultIsFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function defaultWhich(binary: string, env: RuntimeEnv): string | undefined {
  const pathValue = env.PATH ?? env.Path ?? "";
  const extensions =
    process.platform === "win32" ? (env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
  for (const dir of pathValue.split(delimiter)) {
    if (!dir) continue;
    for (const extension of extensions) {
      const candidate = join(dir, `${binary}${extension}`);
      try {
        if (!statSync(candidate).isFile()) continue;
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Not an executable file; keep looking.
      }
    }
  }
  return undefined;
}

function defaultReadVersion(path: string, env: RuntimeEnv): string | null {
  try {
    const result = spawnSync(path, ["--version"], {
      encoding: "utf8",
      timeout: 5000,
      env: env as NodeJS.ProcessEnv,
    });
    if (result.error || result.status !== 0) return null;
    const firstLine = (result.stdout ?? "").trim().split(/\r?\n/, 1)[0]?.trim();
    return firstLine || null;
  } catch {
    return null;
  }
}

function resolveRuntimeDirs(deps: RuntimeDeps, env: RuntimeEnv): string[] {
  if (deps.runtimeDirs) return [...deps.runtimeDirs];
  const configured = env.BAPM_RUNTIME_DIR?.trim();
  if (configured) return [configured];
  const home = deps.homeDir ?? env.HOME ?? env.USERPROFILE ?? homedir();
  return [join(home, ".bapm", "runtimes"), join(home, ".apm", "runtimes")];
}

function buildDetector(deps: RuntimeDeps): Detector {
  const env = deps.env ?? process.env;
  return {
    runtimeDirs: resolveRuntimeDirs(deps, env),
    isFile: deps.isFile ?? defaultIsFile,
    which: deps.which ?? ((binary) => defaultWhich(binary, env)),
    readVersion: deps.readVersion ?? ((_binary, path) => defaultReadVersion(path, env)),
  };
}

function detectRuntime(descriptor: RuntimeDescriptor, detector: Detector): RuntimeRow {
  let binaryPath: string | null = null;
  let source: RuntimeSource | null = null;

  for (const runtimeDir of detector.runtimeDirs) {
    const candidate = join(runtimeDir, descriptor.binary);
    if (detector.isFile(candidate)) {
      binaryPath = candidate;
      source = "runtime";
      break;
    }
  }

  if (!binaryPath) {
    const found = detector.which(descriptor.binary);
    if (found) {
      binaryPath = found;
      source = "path";
    }
  }

  return {
    name: descriptor.name,
    binary: descriptor.binary,
    description: descriptor.description,
    preference: descriptor.preference,
    available: binaryPath !== null,
    source,
    path: binaryPath,
    version: binaryPath ? detector.readVersion(descriptor.binary, binaryPath) : null,
  };
}

export function listRuntimes(deps: RuntimeDeps): RuntimeRow[] {
  const detector = buildDetector(deps);
  return RUNTIME_DESCRIPTORS.map((descriptor) => detectRuntime(descriptor, detector));
}

function printRuntimeTable(rows: RuntimeRow[]): void {
  const headers = ["STATUS", "RUNTIME", "SOURCE", "VERSION", "PATH", "DESCRIPTION"];
  const body = rows.map((row) => [
    row.available ? "installed" : "not installed",
    row.name,
    row.source ?? "-",
    row.version ?? "-",
    row.path ?? "-",
    row.description,
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

function printRuntimeStatus(status: RuntimeStatus): void {
  console.log(`Runtime: ${status.name}`);
  console.log(`Status: ${status.available ? "installed" : "not installed"}`);
  console.log(`Source: ${status.source ?? "-"}`);
  console.log(`Path: ${status.path ?? "-"}`);
  console.log(`Version: ${status.version ?? "-"}`);
  console.log(`Active: ${status.active ? "yes" : "no"}`);
  console.log(`Description: ${status.description}`);
  console.log(`Preference order: ${status.preferenceOrder.join(" -> ")}`);
}

function activeRuntime(rows: RuntimeRow[]): RuntimeName | null {
  return rows.find((row) => row.available)?.name ?? null;
}

export async function runRuntimeCli(
  deps: RuntimeDeps,
  options: RuntimeOptions = {},
): Promise<LifecycleResult> {
  const parsed = parseRuntimeArgs(options.args ?? []);

  if (parsed.sub === "help") {
    console.log(formatRuntimeHelp(deps));
    return { ok: true, exitCode: 0 };
  }

  if (parsed.sub === "error") {
    return errorResult(deps, parsed.message);
  }

  if (parsed.sub === "unsupported") {
    return errorResult(
      deps,
      `runtime ${parsed.command} is not implemented (deferred); bapm runtime is read-only and never downloads, installs, or removes runtimes`,
    );
  }

  if (
    parsed.sub === "status" &&
    parsed.name &&
    !RUNTIME_ORDER.includes(parsed.name as RuntimeName)
  ) {
    return errorResult(
      deps,
      `Unknown runtime "${parsed.name}". Known runtimes: ${RUNTIME_ORDER.join(", ")}`,
    );
  }

  const rows = listRuntimes(deps);

  if (parsed.sub === "list") {
    if (parsed.json) {
      console.log(JSON.stringify(rows, null, 2));
    } else {
      printRuntimeTable(rows);
    }
    return { ok: true, exitCode: 0 };
  }

  const active = activeRuntime(rows);

  if (parsed.name) {
    const row = rows.find((item) => item.name === parsed.name);
    if (!row) {
      return errorResult(
        deps,
        `Unknown runtime "${parsed.name}". Known runtimes: ${RUNTIME_ORDER.join(", ")}`,
      );
    }
    const status: RuntimeStatus = {
      ...row,
      active: row.name === active,
      preferenceOrder: [...RUNTIME_ORDER],
    };
    if (parsed.json) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      printRuntimeStatus(status);
    }
    return { ok: true, exitCode: 0 };
  }

  const summary: RuntimeSummary = {
    active,
    preferenceOrder: [...RUNTIME_ORDER],
    runtimes: rows,
  };
  if (parsed.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Preference order: ${RUNTIME_ORDER.join(" -> ")}`);
    console.log(`Active runtime: ${active ?? "none available"}`);
    console.log();
    printRuntimeTable(rows);
  }
  return { ok: true, exitCode: 0 };
}
