import type { PackDeps, PackOptions, PackResult } from "../types/pack.types.ts";

export function formatPackHelp(deps: PackDeps): string {
  return `${deps.name} pack — Build a plain-zip producer archive and/or marketplace.json

Usage:
  bapm pack [options]

Options:
  --archive                    Write a plain zip artifact (M7 MUST path)
  --agent-plugins              Pack a validated Agent Plugins v1 portable root
  --dry-run                    Validate / collect without durable zip or marketplace.json
  --check-release              pr-004 tag↔manifest version gate
  --check-versions             Marketplace local-package version alignment (lockstep /
                               tag_pattern / per_package); plugin.json fallback when no YAML
  --tag <name>                 Tag under check (optional with --check-release; else HEAD)
  --marketplace <all|none|list>
                               Filter host marketplace emit (claude,codex); default: all configured
  --marketplace-path FORMAT=PATH
                               Override output path for a format (repeatable; must stay under project root)
  --offline                    Fail closed when remote package resolve needs network
  --include-prerelease         Include prerelease tags when resolving version ranges
  --help, -h                   Show this help

Notes:
  Unknown flags are rejected. --check-release never creates or pushes tags.
  --check-versions is distinct from --check-release (marketplace alignment vs tag↔root version).
  Pack refuses secret-pattern paths (.env, *.pem, …) per sc-007.
  Optional project-root .bapmignore (gitignore syntax) omits matching files from the zip;
  root bapm.yml/apm.yml stay included; .gitignore is not used as a fallback.
  When marketplace: is present with outputs selected, pack emits Claude/Codex marketplace.json.
  Marketplace-only projects (no dependencies:) emit JSON and skip empty zip.
  --agent-plugins never emits marketplace output and requires root plugin.json.
`;
}

export type ParsedPackArgs = {
  archive: boolean;
  agentPlugins: boolean;
  dryRun: boolean;
  checkRelease: boolean;
  checkVersions: boolean;
  tag?: string;
  marketplace?: string;
  marketplacePaths: string[];
  offline: boolean;
  includePrerelease: boolean;
  help?: boolean;
  error?: string;
};

export function parsePackArgs(argv: string[]): ParsedPackArgs {
  let archive = false;
  let agentPlugins = false;
  let dryRun = false;
  let checkRelease = false;
  let checkVersions = false;
  let tag: string | undefined;
  let marketplace: string | undefined;
  const marketplacePaths: string[] = [];
  let offline = false;
  let includePrerelease = false;
  let help = false;

  const base = (): Omit<ParsedPackArgs, "error" | "help"> => ({
    archive,
    agentPlugins,
    dryRun,
    checkRelease,
    checkVersions,
    tag,
    marketplace,
    marketplacePaths,
    offline,
    includePrerelease,
  });

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--archive") {
      archive = true;
      continue;
    }
    if (arg === "--agent-plugins") {
      agentPlugins = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--check-release") {
      checkRelease = true;
      continue;
    }
    if (arg === "--check-versions") {
      checkVersions = true;
      continue;
    }
    if (arg === "--offline") {
      offline = true;
      continue;
    }
    if (arg === "--include-prerelease") {
      includePrerelease = true;
      continue;
    }
    if (arg === "--tag") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return { ...base(), error: "Missing value for --tag <name>" };
      }
      tag = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--tag=")) {
      tag = arg.slice("--tag=".length);
      if (!tag) return { ...base(), error: "Missing value for --tag=<name>" };
      continue;
    }
    if (arg === "--marketplace" || arg === "-m") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return { ...base(), error: "Missing value for --marketplace <all|none|list>" };
      }
      marketplace = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--marketplace=")) {
      marketplace = arg.slice("--marketplace=".length);
      if (!marketplace) {
        return { ...base(), error: "Missing value for --marketplace=<all|none|list>" };
      }
      continue;
    }
    if (arg === "--marketplace-path") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return { ...base(), error: "Missing value for --marketplace-path FORMAT=PATH" };
      }
      marketplacePaths.push(next);
      i += 1;
      continue;
    }
    if (arg.startsWith("--marketplace-path=")) {
      const val = arg.slice("--marketplace-path=".length);
      if (!val) {
        return { ...base(), error: "Missing value for --marketplace-path=FORMAT=PATH" };
      }
      marketplacePaths.push(val);
      continue;
    }
    if (arg.startsWith("-")) {
      return {
        ...base(),
        tag,
        error: `Unknown pack flag: ${arg}`,
      };
    }
    return {
      ...base(),
      error: `Unexpected argument: ${arg}`,
    };
  }

  return { ...base(), help };
}

const VERSION_ALIGNMENT_EXIT = 3;

function runCheckVersionsGate(deps: PackDeps, cwd: string | undefined): PackResult {
  const root = cwd ?? process.cwd();
  const detect = deps.detectAuthoringConfigSource;
  const load = deps.loadMarketplaceAuthoringConfig;
  const check = deps.checkVersionAlignment;
  const formatErrors = deps.versionAlignmentErrorMessages;
  if (!detect || !load || !check || !formatErrors) {
    const message = "Internal error: --check-versions deps not wired";
    console.error(`${deps.name}: ${message}`);
    return { ok: false, message, exitCode: 1 };
  }

  const detected = detect({ cwd: root });
  if (!detected.ok || detected.kind === "none") {
    console.log(
      `${deps.name}: Version alignment check skipped: no marketplace block; nothing to check.`,
    );
    return { ok: true, exitCode: 0 };
  }

  let config: unknown;
  try {
    config = load({ cwd: root }).config;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, message, exitCode: 1 };
  }

  const report = check({
    config,
    cwd: root,
    projectRoot: root,
    root,
  });

  if (report.ok) {
    if (report.expected !== null) {
      console.log(
        `${deps.name}: Version alignment OK [strategy=${report.strategy}, expected=${report.expected}]`,
      );
    } else {
      console.log(`${deps.name}: Version alignment OK [strategy=${report.strategy}]`);
    }
    return { ok: true, exitCode: 0 };
  }

  if (report.expected !== null) {
    console.error(
      `${deps.name}: Version alignment failed [strategy=${report.strategy}, expected=${report.expected}]`,
    );
  } else {
    console.error(`${deps.name}: Version alignment failed [strategy=${report.strategy}]`);
  }
  for (const msg of formatErrors(report)) {
    console.error(`${deps.name}: ${msg}`);
  }
  return {
    ok: false,
    message: "Version alignment check failed",
    exitCode: VERSION_ALIGNMENT_EXIT,
  };
}

export async function runPackCli(deps: PackDeps, options: PackOptions): Promise<PackResult> {
  const parsed = parsePackArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatPackHelp(deps));
    return { ok: true };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, message: parsed.error };
  }

  const cwd = options.cwd;

  try {
    // Gate-only when --check-versions without --archive and without marketplace emit intent
    if (parsed.checkVersions && !parsed.archive && parsed.marketplace === undefined) {
      // Still allow combining with check-release gate-only in the same invocation
      if (parsed.checkRelease) {
        const gate = await deps.checkReleaseTag({ cwd, tag: parsed.tag });
        for (const w of gate.warnings ?? []) {
          console.error(`${deps.name}: warning: ${w}`);
        }
      }
      return runCheckVersionsGate(deps, cwd);
    }

    // Gate-only when --check-release without --archive and without marketplace emit intent
    if (parsed.checkRelease && !parsed.archive && parsed.marketplace === undefined) {
      const gate = await deps.checkReleaseTag({ cwd, tag: parsed.tag });
      for (const w of gate.warnings ?? []) {
        console.error(`${deps.name}: warning: ${w}`);
      }
      return { ok: true };
    }

    if (!parsed.archive && !parsed.checkRelease && !parsed.checkVersions) {
      // Default to archive mode for bare `pack` convenience (marketplace-only may skip zip in core)
      parsed.archive = true;
    }

    if (parsed.checkVersions) {
      const versionGate = runCheckVersionsGate(deps, cwd);
      if (!versionGate.ok) return versionGate;
    }

    const result = await deps.runPack({
      cwd,
      agentPlugins: parsed.agentPlugins,
      archive: parsed.archive,
      dryRun: parsed.dryRun,
      checkRelease: parsed.checkRelease,
      tag: parsed.tag,
      marketplace: parsed.marketplace,
      marketplacePaths: parsed.marketplacePaths.length ? parsed.marketplacePaths : undefined,
      offline: parsed.offline,
      includePrerelease: parsed.includePrerelease,
    });

    if (result.archivePath) {
      console.log(`Wrote ${result.archivePath}`);
    } else if (parsed.dryRun) {
      console.log("Dry-run: no durable archive written");
    }
    return {
      ok: true,
      archivePath: result.archivePath,
      marketplaceWritten: result.marketplaceWritten,
    };
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
