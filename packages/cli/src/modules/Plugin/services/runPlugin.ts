import { basename, join, resolve } from "node:path";
import type { PluginDeps, PluginOptions, PluginResult } from "../types/plugin.types.ts";

function nameOk(result: { ok: boolean; message?: string } | boolean): boolean {
  if (typeof result === "boolean") return result;
  return Boolean(result?.ok);
}

function nameMessage(
  result: { ok: boolean; message?: string } | boolean,
  fallback: string,
): string {
  if (typeof result === "object" && result && typeof result.message === "string") {
    return result.message;
  }
  return fallback;
}

export function formatPluginHelp(deps: PluginDeps): string {
  return `${deps.name} plugin — Producer plugin scaffolds

Usage:
  bapm plugin <subcommand>

Subcommands:
  init    Scaffold plugin.json + ${deps.manifestFile} (thin plugin project)

Run \`bapm plugin <subcommand> --help\` for details.
`;
}

export function formatPluginInitHelp(deps: PluginDeps): string {
  return `${deps.name} plugin init — Scaffold a thin plugin project

Usage:
  bapm plugin init [options] [PROJECT_NAME]

Options:
  -y, --yes           Non-interactive defaults (version 0.1.0); allow overwrite
  --target <id>       Record host target (e.g. cursor)
  --agent-plugins     Create an Agent Plugins v1 portable root (no bapm.yml)
  --skills            Include a minimal portable skills/example/SKILL.md layout
  -v, --verbose       Extra logging (optional)
  --help, -h          Show this help

Notes:
  Writes plugin.json and ${deps.manifestFile} only (no SKILL.md / agents / skills).
  --agent-plugins writes canonical portable plugin.json only; --skills opts into its skills layout.
  Without --yes, refuses if ${deps.manifestFile} or plugin.json already exists.
  PROJECT_NAME creates a subdirectory (kebab-case; no path separators).
  Unknown flags are rejected. Offline only — no network.
`;
}

export function parsePluginArgs(argv: string[]): {
  help?: boolean;
  subcommand?: string;
  rest: string[];
  error?: string;
} {
  if (argv.length === 0) {
    return { help: true, rest: [] };
  }

  const [first, ...rest] = argv;
  if (first === "--help" || first === "-h") {
    return { help: true, rest: [] };
  }
  if (first?.startsWith("-")) {
    return { rest: [], error: `Unknown plugin flag: ${first}` };
  }
  return { subcommand: first, rest };
}

export function parsePluginInitArgs(argv: string[]): {
  yes: boolean;
  help?: boolean;
  verbose: boolean;
  agentPlugins: boolean;
  skills: boolean;
  target?: string;
  projectName?: string;
  error?: string;
} {
  let yes = false;
  let help = false;
  let verbose = false;
  let agentPlugins = false;
  let skills = false;
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
    if (arg === "-v" || arg === "--verbose") {
      verbose = true;
      continue;
    }
    if (arg === "--agent-plugins") {
      agentPlugins = true;
      continue;
    }
    if (arg === "--skills") {
      skills = true;
      continue;
    }
    if (arg === "--target") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return { yes, verbose, agentPlugins, skills, error: "Missing value for --target <id>" };
      }
      target = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--target=")) {
      target = arg.slice("--target=".length);
      if (!target) {
        return { yes, verbose, agentPlugins, skills, error: "Missing value for --target=<id>" };
      }
      continue;
    }
    if (arg.startsWith("-")) {
      return {
        yes,
        verbose,
        agentPlugins,
        skills,
        target,
        error: `Unknown plugin init flag: ${arg}`,
      };
    }
    if (projectName === undefined) {
      projectName = arg;
      continue;
    }
    return {
      yes,
      verbose,
      agentPlugins,
      skills,
      target,
      projectName,
      error: `Unexpected argument: ${arg}`,
    };
  }

  return { yes, help, verbose, agentPlugins, skills, target, projectName };
}

export async function runPluginInit(
  deps: PluginDeps,
  options: PluginOptions,
): Promise<PluginResult> {
  const parsed = parsePluginInitArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatPluginInitHelp(deps));
    return { ok: true };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, message: parsed.error };
  }

  const parentCwd = resolve(options.cwd ?? process.cwd());

  if (parsed.agentPlugins && parsed.target) {
    const message = "--target is an APM scaffold option and cannot be used with --agent-plugins";
    console.error(`${deps.name}: ${message}`);
    return { ok: false, message };
  }

  if (parsed.projectName !== undefined) {
    const projectCheck = deps.validateProjectName(parsed.projectName);
    if (!nameOk(projectCheck)) {
      const message = nameMessage(
        projectCheck,
        `Invalid project name: ${JSON.stringify(parsed.projectName)}`,
      );
      console.error(`${deps.name}: ${message}`);
      return { ok: false, message };
    }

    const pluginCheck = deps.validatePluginName(parsed.projectName);
    if (!nameOk(pluginCheck)) {
      const message = nameMessage(
        pluginCheck,
        `Invalid plugin name: ${JSON.stringify(parsed.projectName)}`,
      );
      console.error(`${deps.name}: ${message}`);
      return { ok: false, message };
    }
  }

  const pluginName = parsed.projectName?.trim() || basename(parentCwd);
  const nameCheck = deps.validatePluginName(pluginName);
  if (!nameOk(nameCheck)) {
    const message = nameMessage(nameCheck, `Invalid plugin name: ${JSON.stringify(pluginName)}`);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, message };
  }

  const cwd = parsed.projectName !== undefined ? join(parentCwd, parsed.projectName) : parentCwd;

  const pluginJsonPath = join(cwd, "plugin.json");
  const bapmPath = join(cwd, deps.manifestFile);

  if (
    !parsed.yes &&
    (deps.existsSync(pluginJsonPath) || (!parsed.agentPlugins && deps.existsSync(bapmPath)))
  ) {
    const which = deps.existsSync(pluginJsonPath) ? "plugin.json" : deps.manifestFile;
    const message = `Refusing to plugin init: ${which} already exists (pass --yes to overwrite)`;
    console.error(`${deps.name}: ${message}`);
    return { ok: false, message };
  }

  if (parsed.projectName !== undefined && !deps.existsSync(cwd)) {
    deps.mkdirSync(cwd, { recursive: true });
  }

  try {
    if (parsed.agentPlugins) {
      const { manifestPath } = deps.writeAgentPluginManifest({
        root: cwd,
        path: pluginJsonPath,
        name: pluginName,
        version: "0.1.0",
        description: "",
        author: { name: "author" },
        license: "MIT",
      });
      if (parsed.skills) {
        const skillPath = join(cwd, "skills", "example", "SKILL.md");
        deps.mkdirSync(join(cwd, "skills", "example"), { recursive: true });
        deps.writeFileSync(skillPath, "---\nname: example\n---\n# Example\n", "utf8");
      }
      if (parsed.verbose) console.log(`Wrote ${manifestPath}`);
      console.log(`Created Agent Plugins v1 scaffold in ${cwd}`);
      console.log("");
      console.log("Next steps:");
      console.log("  bapm pack --agent-plugins   # build a portable plugin archive");
      return { ok: true, path: cwd };
    }

    const document = deps.createMinimalManifest({
      name: pluginName,
      version: "0.1.0",
      description: "",
      author: "author",
      pluginMode: true,
      ...(parsed.target ? { target: parsed.target } : {}),
    });
    const { path: manifestPath } = deps.writeProducerManifest(document, {
      cwd,
      path: bapmPath,
    });
    const jsonPath = deps.writePluginJson({
      cwd,
      path: pluginJsonPath,
      name: pluginName,
      version: "0.1.0",
      description: "",
      author: { name: "author" },
      license: "MIT",
    });

    if (parsed.verbose) {
      console.log(`Wrote ${manifestPath}`);
      console.log(`Wrote ${jsonPath}`);
    }

    console.log(`Created plugin scaffold in ${cwd}`);
    console.log("");
    console.log("Next steps:");
    console.log("  bapm install --dev   # install local plugin deps for development");
    console.log("  bapm pack            # build a producer pack archive");
    return { ok: true, path: cwd };
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

export async function runPlugin(deps: PluginDeps, options: PluginOptions): Promise<PluginResult> {
  const parsed = parsePluginArgs(options.args ?? []);
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, message: parsed.error };
  }
  if (parsed.help || !parsed.subcommand) {
    console.log(formatPluginHelp(deps));
    return { ok: true };
  }

  if (parsed.subcommand === "init") {
    return runPluginInit(deps, { ...options, args: parsed.rest });
  }

  const message = `Unknown plugin subcommand: ${parsed.subcommand}`;
  console.error(`${deps.name}: ${message}`);
  return { ok: false, message };
}
