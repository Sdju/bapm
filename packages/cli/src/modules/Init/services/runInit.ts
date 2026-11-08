import { basename, join, resolve } from "node:path";
import type { InitDeps, InitOptions, InitResult } from "../types/init.types.ts";
import type { ProjectDiscoveryReport } from "../types/discover.types.ts";
import { discoverProject } from "./discover.ts";

export type ParsedInitArgs = {
  yes: boolean;
  help?: boolean;
  discover?: boolean;
  json?: boolean;
  apply?: boolean;
  target?: string;
  projectName?: string;
  error?: string;
};

export function formatInitHelp(deps: InitDeps): string {
  return `${deps.name} init — Scaffold a new ${deps.manifestFile}

Usage:
  bapm init [options] [project-name]
  bapm init --discover [--json] [--apply]

Options:
  -y, --yes           Non-interactive defaults (version 0.1.0)
  --target <id>       Activate an agent (e.g. cursor) through the manifest active field.
                      Activation does not narrow deployment; targets: is not written.
  --discover          Inspect existing agent harness content: host markers, skills,
                      rules/instructions, commands, hooks, and MCP configs.
  --json              With --discover: stable machine-readable report.
  --apply             With --discover: create bapm.yml with the suggested active targets.
                      Requires explicit consent, refuses an existing manifest, and never
                      deletes or moves existing files.
  --help, -h          Show this help

Notes:
  Writes ${deps.manifestFile} only. Refuses if apm.yml or bapm.yml already exists.
  --discover is read-only unless --apply is also passed. Discovery does not load host
  packages or use the network. Unknown flags are rejected. For plugin or marketplace
  scaffolds use bapm plugin init / bapm marketplace init.
`;
}

export function parseInitArgs(argv: string[]): ParsedInitArgs {
  let yes = false;
  let help = false;
  let discover = false;
  let json = false;
  let apply = false;
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
    if (arg === "--discover") {
      discover = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--target") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return { yes, discover, json, apply, error: "Missing value for --target <id>" };
      }
      target = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--target=")) {
      target = arg.slice("--target=".length);
      if (!target) return { yes, discover, json, apply, error: "Missing value for --target=<id>" };
      continue;
    }
    if (arg.startsWith("-")) {
      return { yes, discover, json, apply, target, error: `Unknown init flag: ${arg}` };
    }
    if (projectName === undefined) {
      projectName = arg;
      continue;
    }
    return {
      yes,
      discover,
      json,
      apply,
      target,
      projectName,
      error: `Unexpected argument: ${arg}`,
    };
  }

  if (json && !discover) return { yes, discover, json, apply, error: "--json requires --discover" };
  if (apply && !discover) {
    return { yes, discover, json, apply, error: "--apply requires --discover" };
  }
  if (discover && projectName !== undefined) {
    return {
      yes,
      discover,
      json,
      apply,
      error: `Unexpected argument with --discover: ${projectName}`,
    };
  }
  if (discover && target !== undefined) {
    return {
      yes,
      discover,
      json,
      apply,
      target,
      error: "--target cannot be combined with --discover (suggested active comes from detection)",
    };
  }

  return { yes, help, discover, json, apply, target, projectName };
}

/**
 * Record activation only. Do not emit `target` / `targets`: those fields are a
 * deployment allowlist (intersection), not host selection, so writing them would
 * silently cut off other agents later. Canonical hosts resolve through
 * `@b-apm/integration-<id>` fallback.
 */
function scaffoldTargetFields(targetId: string): {
  active: { target: string };
} {
  return { active: { target: targetId.trim() } };
}

function printDiscoveryReport(report: ProjectDiscoveryReport): void {
  console.log(`Manifest: ${report.manifest.path ?? "(none)"}`);
  if (report.hosts.length === 0) {
    console.log("Detected hosts: none");
  } else {
    console.log("Detected hosts:");
    for (const host of report.hosts) {
      console.log(`  ${host.id.padEnd(14)} ${host.markers.join(", ")}`);
    }
  }
  console.log(
    `Counts: skills=${report.counts.skills} rules=${report.counts.rules} ` +
      `commands=${report.counts.commands} hooks=${report.counts.hooks} mcp=${report.counts.mcp}`,
  );
  console.log(
    `Suggested active: ${report.suggestedActive.length > 0 ? report.suggestedActive.join(", ") : "(none)"}`,
  );
}

function runDiscover(deps: InitDeps, cwd: string, parsed: ParsedInitArgs): InitResult {
  const report = discoverProject(cwd);

  if (!parsed.apply) {
    if (parsed.json) {
      console.log(JSON.stringify(report, null, 2));
      return { ok: true };
    }
    printDiscoveryReport(report);
    console.log("No files were written (preview). Re-run with --apply to create bapm.yml.");
    return { ok: true };
  }

  if (report.manifest.exists) {
    const message = `Refusing to init --discover --apply: ${report.manifest.path} already exists (will not overwrite)`;
    console.error(`${deps.name}: ${message}`);
    return { ok: false, message };
  }

  const name = basename(cwd);
  if (!name) {
    const message = "Project name is required (run inside a named directory)";
    console.error(`${deps.name}: ${message}`);
    return { ok: false, message };
  }

  try {
    const active = report.suggestedActive.map((targetId) => ({ target: targetId }));
    const document = deps.createMinimalManifest({
      name,
      version: "0.1.0",
      ...(active.length > 0 ? { active } : {}),
    });
    const { path } = deps.writeProducerManifest(document, {
      cwd,
      path: join(cwd, "bapm.yml"),
    });
    const appliedReport: ProjectDiscoveryReport = {
      ...report,
      applied: true,
      manifestPath: path,
    };
    if (parsed.json) {
      console.log(JSON.stringify(appliedReport, null, 2));
    } else {
      printDiscoveryReport(appliedReport);
      console.log(`Created ${path}`);
      console.log(
        `Active: ${report.suggestedActive.length > 0 ? report.suggestedActive.join(", ") : "(none)"}`,
      );
    }
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
  if (parsed.discover) return runDiscover(deps, cwd, parsed);

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
      ...(target ? scaffoldTargetFields(target) : {}),
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
