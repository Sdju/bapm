import type { PackDeps, PackOptions, PackResult } from "../types/pack.types.ts";

export function formatPackHelp(deps: PackDeps): string {
  return `${deps.name} pack — Build a plain-zip producer archive

Usage:
  bapm pack [options]

Options:
  --archive           Write a plain zip artifact (M7 MUST path)
  --dry-run           Validate / collect without leaving a durable zip
  --check-release     pr-004 tag↔manifest version gate
  --tag <name>        Tag under check (optional with --check-release; else HEAD)
  --help, -h          Show this help

Notes:
  Unknown flags are rejected. --check-release never creates or pushes tags.
  Pack refuses secret-pattern paths (.env, *.pem, …) per sc-007.
`;
}

export function parsePackArgs(argv: string[]): {
  archive: boolean;
  dryRun: boolean;
  checkRelease: boolean;
  tag?: string;
  help?: boolean;
  error?: string;
} {
  let archive = false;
  let dryRun = false;
  let checkRelease = false;
  let tag: string | undefined;
  let help = false;

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
    if (arg === "--tag") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return { archive, dryRun, checkRelease, error: "Missing value for --tag <name>" };
      }
      tag = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--tag=")) {
      tag = arg.slice("--tag=".length);
      if (!tag) return { archive, dryRun, checkRelease, error: "Missing value for --tag=<name>" };
      continue;
    }
    if (arg.startsWith("-")) {
      return {
        archive,
        dryRun,
        checkRelease,
        tag,
        error: `Unknown pack flag: ${arg}`,
      };
    }
    return {
      archive,
      dryRun,
      checkRelease,
      tag,
      error: `Unexpected argument: ${arg}`,
    };
  }

  return { archive, dryRun, checkRelease, tag, help };
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
    // Gate-only when --check-release without --archive
    if (parsed.checkRelease && !parsed.archive) {
      const gate = await deps.checkReleaseTag({ cwd, tag: parsed.tag });
      for (const w of gate.warnings ?? []) {
        console.error(`${deps.name}: warning: ${w}`);
      }
      return { ok: true };
    }

    if (!parsed.archive && !parsed.checkRelease) {
      // Default to archive mode for bare `pack` convenience
      parsed.archive = true;
    }

    const result = await deps.runPack({
      cwd,
      archive: parsed.archive,
      dryRun: parsed.dryRun,
      checkRelease: parsed.checkRelease,
      tag: parsed.tag,
    });

    if (result.archivePath) {
      console.log(`Wrote ${result.archivePath}`);
    } else if (parsed.dryRun) {
      console.log("Dry-run: no durable archive written");
    }
    return { ok: true, archivePath: result.archivePath };
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
