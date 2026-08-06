import type { PackDeps, PackOptions, PackResult } from "../types/pack.types.ts";

export function formatPackHelp(deps: PackDeps): string {
  return `${deps.name} pack — Build a plain-zip producer archive and/or marketplace.json

Usage:
  bapm pack [options]

Options:
  --archive                    Write a plain zip artifact (M7 MUST path)
  --dry-run                    Validate / collect without durable zip or marketplace.json
  --check-release              pr-004 tag↔manifest version gate
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
  Pack refuses secret-pattern paths (.env, *.pem, …) per sc-007.
  When marketplace: is present with outputs selected, pack emits Claude/Codex marketplace.json.
  Marketplace-only projects (no dependencies:) emit JSON and skip empty zip.
`;
}

export type ParsedPackArgs = {
  archive: boolean;
  dryRun: boolean;
  checkRelease: boolean;
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
  let dryRun = false;
  let checkRelease = false;
  let tag: string | undefined;
  let marketplace: string | undefined;
  const marketplacePaths: string[] = [];
  let offline = false;
  let includePrerelease = false;
  let help = false;

  const base = (): Omit<ParsedPackArgs, "error" | "help"> => ({
    archive,
    dryRun,
    checkRelease,
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
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--check-release") {
      checkRelease = true;
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
    // Gate-only when --check-release without --archive and without marketplace emit intent
    if (parsed.checkRelease && !parsed.archive && parsed.marketplace === undefined) {
      const gate = await deps.checkReleaseTag({ cwd, tag: parsed.tag });
      for (const w of gate.warnings ?? []) {
        console.error(`${deps.name}: warning: ${w}`);
      }
      return { ok: true };
    }

    if (!parsed.archive && !parsed.checkRelease) {
      // Default to archive mode for bare `pack` convenience (marketplace-only may skip zip in core)
      parsed.archive = true;
    }

    const result = await deps.runPack({
      cwd,
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
