import { basename, join, resolve } from "node:path";
import type { InitDeps, InitOptions, InitResult } from "../types/init.types.ts";

export function formatInitHelp(deps: InitDeps): string {
  return `${deps.name} init — Scaffold a new ${deps.manifestFile}

Usage:
  bapm init [options] [project-name]

Options:
  -y, --yes           Non-interactive defaults (version 0.1.0)
  --target <id>       Record host target (e.g. cursor)
  --help, -h          Show this help

Notes:
  Writes ${deps.manifestFile} only. Refuses if apm.yml or bapm.yml already exists.
  Unknown flags are rejected. No plugin / marketplace scaffold in M7.
`;
}

export function parseInitArgs(argv: string[]): {
  yes: boolean;
  help?: boolean;
  target?: string;
  projectName?: string;
  error?: string;
} {
  let yes = false;
  let help = false;
  let target: string | undefined;
  let projectName: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "-y" || arg === "--yes") {
      yes = true;
      continue;
    }
    if (arg === "--target") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return { yes, error: "Missing value for --target <id>" };
      }
      target = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--target=")) {
      target = arg.slice("--target=".length);
      if (!target) return { yes, error: "Missing value for --target=<id>" };
      continue;
    }
    if (arg.startsWith("-")) {
      return { yes, target, error: `Unknown init flag: ${arg}` };
    }
    if (projectName === undefined) {
      projectName = arg;
      continue;
    }
    return { yes, target, projectName, error: `Unexpected argument: ${arg}` };
  }

  return { yes, help, target, projectName };
}

export async function runInit(deps: InitDeps, options: InitOptions): Promise<InitResult> {
  const parsed = parseInitArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatInitHelp(deps));
    return { ok: true };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, message: parsed.error };
  }

  const cwd = resolve(options.cwd ?? process.cwd());
  const apmPath = join(cwd, "apm.yml");
  const bapmPath = join(cwd, "bapm.yml");

  if (deps.existsSync(apmPath) || deps.existsSync(bapmPath)) {
    const which = deps.existsSync(bapmPath) ? "bapm.yml" : "apm.yml";
    const message = `Refusing to init: ${which} already exists (will not overwrite)`;
    console.error(`${deps.name}: ${message}`);
    return { ok: false, message };
  }

  const name = parsed.projectName?.trim() || basename(cwd);
  if (!name) {
    const message = "Project name is required (pass a name or run inside a named directory)";
    console.error(`${deps.name}: ${message}`);
    return { ok: false, message };
  }

  let target = parsed.target;
  if (!target && deps.detectCursor(cwd)) {
    target = "cursor";
  }

  try {
    const document = deps.createMinimalManifest({
      name,
      version: "0.1.0",
      ...(target ? { target } : {}),
    });
    const { path } = deps.writeProducerManifest(document, {
      cwd,
      path: bapmPath,
    });
    console.log(`Created ${path}`);
    return { ok: true, path };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, message };
  }
}
