/**
 * `bapm run` / `bapm preview` — run project scripts from the manifest.
 *
 * Scripts are shell command lines declared under `scripts:` in `bapm.yml`
 * (or `apm.yml`). They execute with the user's privileges in the project
 * directory. bapm never evaluates script text as JavaScript; parameter values
 * are substituted as shell-quoted literals.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { ManifestError, loadManifest, type BapmManifest } from "@b-apm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type ScriptCommand = "run" | "preview";

export type ScriptExecOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
};

export type ScriptExecResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
};

/** Injectable process runner (tests / embedders). Defaults to spawnSync + shell. */
export type ScriptExec = (command: string, options: ScriptExecOptions) => ScriptExecResult;

export type ScriptManifestLoader = (options: { cwd: string }) => {
  document: BapmManifest;
  sourcePath: string;
};

export type RunCliDeps = LifecycleCliDeps & {
  /** Manifest loader override (defaults to core `loadManifest`). */
  loadProject?: ScriptManifestLoader;
  /** Process runner override (defaults to a shell via spawnSync). */
  exec?: ScriptExec;
  /** Base environment for spawned commands (defaults to `process.env`). */
  env?: NodeJS.ProcessEnv;
  /** Host platform used for shell quoting (defaults to `process.platform`). */
  platform?: NodeJS.Platform;
};

export type ScriptOptions = {
  args?: string[];
  cwd?: string;
};

export type ParsedScriptArgs = {
  script?: string;
  params: Array<[string, string]>;
  verbose: boolean;
  dryRun: boolean;
  help?: boolean;
  error?: string;
};

const PARAM_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PLACEHOLDER_RE =
  /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}|\$\{input:([A-Za-z_][A-Za-z0-9_]*)\}/g;

export type ScriptHelpDeps = Pick<LifecycleCliDeps, "name" | "manifestFile">;

export function formatScriptHelp(deps: ScriptHelpDeps, command: ScriptCommand): string {
  if (command === "preview") {
    return `${deps.name} preview — Resolve a manifest script without executing it

Usage:
  bapm preview [SCRIPT] [-p name=value]... [-v]

Arguments:
  SCRIPT               Script name from ${deps.manifestFile} scripts: (default: start)

Options:
  -p, --param name=value
                       Substitute {{name}} / \${input:name}; also exports PARAM_NAME
  -v, --verbose        Show manifest path, cwd, and exported parameter names
  -h, --help           Show this help

Preview prints the original command, the shell-quoted resolved command, and the
parameters. Nothing is executed. Exit code is non-zero when the manifest or
script is missing.

Security:
  Scripts in ${deps.manifestFile} execute with your user privileges through the
  system shell in the project directory. Placeholders should be standalone
  tokens (for example: echo {{name}}), not inside shell quotes. Parameter values
  are single-quote escaped before substitution; bapm never evals them.
`;
  }

  return `${deps.name} run — Run a manifest script

Usage:
  bapm run [SCRIPT] [-p name=value]... [-v] [--dry-run]

Arguments:
  SCRIPT               Script name from ${deps.manifestFile} scripts: (default: start)

Options:
  -p, --param name=value
                       Substitute {{name}} / \${input:name}; also exports PARAM_NAME
  -v, --verbose        Show the resolved command, cwd, and parameter names
  --dry-run            Resolve and print the command without executing it
  -h, --help           Show this help

Missing scripts print the available names and exit non-zero. A command that
exits non-zero makes bapm exit with the same code (or 1 when terminated).

Security:
  Scripts in ${deps.manifestFile} execute with your user privileges through the
  system shell in the project directory. Placeholders should be standalone
  tokens (for example: echo {{name}}), not inside shell quotes. Parameter values
  are single-quote escaped before substitution; bapm never evals them.
`;
}

function parseParam(raw: string): { name: string; value: string } | { error: string } {
  const separator = raw.indexOf("=");
  if (separator <= 0) {
    return { error: "Invalid parameter (expected name=value)" };
  }
  const name = raw.slice(0, separator);
  const value = raw.slice(separator + 1);
  if (!PARAM_NAME_RE.test(name)) {
    return {
      error: `Invalid parameter name "${name}" (expected [A-Za-z_][A-Za-z0-9_]*)`,
    };
  }
  return { name, value };
}

export function parseScriptArgs(
  argv: string[],
  options: { allowDryRun: boolean },
): ParsedScriptArgs {
  const params: Array<[string, string]> = [];
  const positionals: string[] = [];
  let verbose = false;
  let dryRun = false;
  let endOfFlags = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;

    if (!endOfFlags && arg === "--") {
      endOfFlags = true;
      continue;
    }
    if (!endOfFlags && (arg === "--help" || arg === "-h")) {
      return { params, verbose, dryRun, help: true };
    }
    if (!endOfFlags && (arg === "--verbose" || arg === "-v")) {
      verbose = true;
      continue;
    }
    if (!endOfFlags && arg === "--dry-run" && options.allowDryRun) {
      dryRun = true;
      continue;
    }
    if (!endOfFlags && (arg === "-p" || arg === "--param")) {
      const value = argv[index + 1];
      if (value === undefined) {
        return { params, verbose, dryRun, error: `Missing value for ${arg} (expected name=value)` };
      }
      index += 1;
      const parsed = parseParam(value);
      if ("error" in parsed) return { params, verbose, dryRun, error: parsed.error };
      params.push([parsed.name, parsed.value]);
      continue;
    }
    if (!endOfFlags && (arg.startsWith("--param=") || arg.startsWith("-p="))) {
      const raw = arg.slice(arg.indexOf("=") + 1);
      const parsed = parseParam(raw);
      if ("error" in parsed) return { params, verbose, dryRun, error: parsed.error };
      params.push([parsed.name, parsed.value]);
      continue;
    }
    if (!endOfFlags && arg.startsWith("-")) {
      return { params, verbose, dryRun, error: `Unknown flag: ${arg}` };
    }
    positionals.push(arg);
  }

  if (positionals.length > 1) {
    return {
      params,
      verbose,
      dryRun,
      error: `Expected one script name, got: ${positionals.join(" ")}`,
    };
  }

  return {
    params,
    verbose,
    dryRun,
    ...(positionals[0] !== undefined ? { script: positionals[0] } : {}),
  };
}

/** POSIX single-quote escaping; on Windows quote for cmd.exe. */
export function shellQuote(value: string, platform: NodeJS.Platform = process.platform): string {
  if (platform === "win32") {
    return `"${value.replace(/%/g, "%%").replace(/"/g, '\\"')}"`;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Replace bound `{{name}}` / `${input:name}` placeholders with quoted values. */
export function substituteScriptCommand(
  command: string,
  params: ReadonlyMap<string, string>,
  platform: NodeJS.Platform = process.platform,
): string {
  return command.replace(PLACEHOLDER_RE, (match, braceName: string, inputName: string) => {
    const name = braceName ?? inputName;
    const value = params.get(name);
    if (value === undefined) return match;
    return shellQuote(value, platform);
  });
}

/** Export each parameter as `PARAM_<UPPERCASE_NAME>` for scripts that prefer env. */
export function paramEnvironment(params: ReadonlyMap<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of params) {
    env[`PARAM_${name.toUpperCase()}`] = value;
  }
  return env;
}

function defaultExec(command: string, options: ScriptExecOptions): ScriptExecResult {
  const result = spawnSync(command, {
    shell: true,
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
    ...(result.error ? { error: result.error } : {}),
  };
}

function fail(message: string): LifecycleResult {
  return { ok: false, exitCode: 1, message };
}

function printAvailableScripts(scripts: Record<string, string>): void {
  const entries = Object.entries(scripts);
  console.log("Available scripts:");
  if (entries.length === 0) {
    console.log("  (none)");
    return;
  }
  const width = Math.max(...entries.map(([name]) => name.length));
  for (const [name, command] of entries) {
    console.log(`  ${name.padEnd(width)}  ${command}`);
  }
}

function formatParameterList(params: ReadonlyMap<string, string>): string {
  if (params.size === 0) return "(none)";
  return [...params].map(([name, value]) => `${name}=${value}`).join(" ");
}

function printPreview(args: {
  name: string;
  command: string;
  resolved: string;
  params: ReadonlyMap<string, string>;
  cwd: string;
  sourcePath: string;
  verbose: boolean;
  dryRun: boolean;
}): void {
  if (args.dryRun) console.log("dry-run: command not executed");
  console.log(`script: ${args.name}`);
  console.log(`original: ${args.command}`);
  console.log(`resolved: ${args.resolved}`);
  console.log(`parameters: ${formatParameterList(args.params)}`);
  if (args.verbose) {
    console.log(`manifest: ${args.sourcePath}`);
    console.log(`cwd: ${args.cwd}`);
    const envNames = [...args.params.keys()].map((name) => `PARAM_${name.toUpperCase()}`);
    console.log(`env: ${envNames.length > 0 ? envNames.join(" ") : "(none)"}`);
  }
}

function writeCaptured(stdout: string, stderr: string): void {
  if (stdout.length > 0) console.log(stdout.replace(/\r?\n$/, ""));
  if (stderr.length > 0) console.error(stderr.replace(/\r?\n$/, ""));
}

export async function runScriptCli(
  deps: RunCliDeps,
  command: ScriptCommand,
  options: ScriptOptions = {},
): Promise<LifecycleResult> {
  const parsed = parseScriptArgs(options.args ?? [], { allowDryRun: command === "run" });
  if (parsed.help) {
    console.log(formatScriptHelp(deps, command));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return fail(parsed.error);
  }

  const cwd = resolve(options.cwd ?? process.cwd());
  let loaded: { document: BapmManifest; sourcePath: string };
  try {
    loaded = (deps.loadProject ?? loadManifest)({ cwd });
  } catch (error) {
    if (
      error instanceof ManifestError &&
      (error.code === "MANIFEST_NOT_FOUND" || error.code === "MANIFEST_MISSING_FILE")
    ) {
      console.error(`${deps.name}: no ${deps.manifestFile} or apm.yml found in ${cwd}`);
      return fail("manifest not found");
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return fail(message);
  }

  const scripts = loaded.document.scripts ?? {};
  let name: string;
  let scriptCommand: string;

  if (parsed.script !== undefined) {
    name = parsed.script;
    if (!Object.hasOwn(scripts, name)) {
      const message = `script "${name}" not found in ${loaded.sourcePath}`;
      console.error(`${deps.name}: ${message}`);
      printAvailableScripts(scripts);
      return fail(message);
    }
    scriptCommand = scripts[name]!;
  } else if (Object.hasOwn(scripts, "start")) {
    name = "start";
    scriptCommand = scripts.start!;
  } else {
    const message = `no script specified and no "start" script defined in ${loaded.sourcePath}`;
    console.error(`${deps.name}: ${message}`);
    printAvailableScripts(scripts);
    return fail(message);
  }

  const paramMap = new Map<string, string>();
  for (const [key, value] of parsed.params) paramMap.set(key, value);

  const platform = deps.platform ?? process.platform;
  const resolvedCommand = substituteScriptCommand(scriptCommand, paramMap, platform);

  if (command === "preview" || parsed.dryRun) {
    printPreview({
      name,
      command: scriptCommand,
      resolved: resolvedCommand,
      params: paramMap,
      cwd,
      sourcePath: loaded.sourcePath,
      verbose: parsed.verbose,
      dryRun: parsed.dryRun,
    });
    return { ok: true, exitCode: 0 };
  }

  if (parsed.verbose) {
    console.log(`${deps.name}: running script "${name}"`);
    console.log(`command: ${resolvedCommand}`);
    console.log(`cwd: ${cwd}`);
    console.log(`parameters: ${formatParameterList(paramMap)}`);
  }

  const exec = deps.exec ?? defaultExec;
  const baseEnv = deps.env ?? process.env;
  let result: ScriptExecResult;
  try {
    result = exec(resolvedCommand, {
      cwd,
      env: { ...baseEnv, ...paramEnvironment(paramMap) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: failed to execute script "${name}": ${message}`);
    return fail(message);
  }

  writeCaptured(result.stdout, result.stderr);

  if (result.error) {
    const message = `failed to execute script "${name}": ${result.error.message}`;
    console.error(`${deps.name}: ${message}`);
    return fail(message);
  }
  if (result.status !== 0) {
    const exitCode = result.status ?? 1;
    const message =
      result.status === null
        ? `script "${name}" terminated before exiting`
        : `script "${name}" failed with exit code ${exitCode}`;
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: exitCode === 0 ? 1 : exitCode, message };
  }

  return { ok: true, exitCode: 0 };
}
