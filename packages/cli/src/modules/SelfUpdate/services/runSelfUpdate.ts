import { spawn } from "node:child_process";
import type {
  SelfUpdateDeps,
  SelfUpdateOptions,
  SelfUpdateResult,
} from "../types/selfUpdate.types.ts";

export function formatSelfUpdateHelp(deps: SelfUpdateDeps): string {
  return `${deps.name} self-update — Check / apply CLI updates (npm)

Usage:
  bapm self-update [--check]

Options:
  --check              Compare running version to npm dist-tag latest
  --help, -h           Show this help

Exit policy (--check):
  0  up-to-date
  1  update available, unknown version, or check failed

Upgrade path:
  npm i -g bapm@<version>
  (or: npm update -g bapm)

Without --check, runs the npm global upgrade path unless BAPM_SELF_UPDATE_DISABLE=1.
Unknown flags are rejected.
`;
}

export function parseSelfUpdateArgs(argv: string[]): {
  check: boolean;
  help?: boolean;
  error?: string;
} {
  let check = false;
  let help = false;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--check") {
      check = true;
      continue;
    }
    if (arg.startsWith("-")) {
      return { check, error: `Unknown self-update flag: ${arg}` };
    }
    return { check, error: `Unexpected argument: ${arg}` };
  }

  return { check, help };
}

export async function runSelfUpdateCli(
  deps: SelfUpdateDeps,
  options: SelfUpdateOptions,
): Promise<SelfUpdateResult> {
  const parsed = parseSelfUpdateArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatSelfUpdateHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, message: parsed.error, exitCode: 1 };
  }

  const currentVersion = process.env.BAPM_VERSION_OVERRIDE?.trim() || deps.getVersion();

  try {
    const result = await deps.checkSelfUpdate({
      currentVersion,
      registryUrl:
        process.env.BAPM_SELF_UPDATE_METADATA_URL ??
        process.env.BAPM_NPM_REGISTRY ??
        process.env.npm_config_registry,
    });

    if (parsed.check) {
      if (result.unknownVersion) {
        console.error(result.message);
        return { ok: false, message: result.message, exitCode: 1 };
      }
      if (result.updateAvailable) {
        console.log(result.message);
        return { ok: false, message: result.message, exitCode: 1 };
      }
      console.log(result.message);
      return { ok: true, exitCode: 0 };
    }

    // SHOULD: upgrade path without --check
    if (process.env.BAPM_SELF_UPDATE_DISABLE === "1") {
      console.error(
        `${deps.name}: self-update upgrade path disabled (BAPM_SELF_UPDATE_DISABLE=1). Use: npm i -g bapm@latest`,
      );
      return { ok: false, exitCode: 1 };
    }

    if (result.unknownVersion) {
      console.error(result.message);
      return { ok: false, message: result.message, exitCode: 1 };
    }

    if (!result.updateAvailable) {
      console.log(result.message);
      return { ok: true, exitCode: 0 };
    }

    const target = result.latestVersion ?? "latest";
    if (deps.runUpgrade) {
      await deps.runUpgrade(target);
    } else {
      await defaultNpmUpgrade(deps.name, target);
    }
    console.log(`Upgraded via npm i -g bapm@${target}`);
    return { ok: true, exitCode: 0 };
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
}

function defaultNpmUpgrade(pkg: string, version: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("npm", ["i", "-g", `${pkg}@${version}`], {
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`npm i -g ${pkg}@${version} exited ${code}`));
    });
  });
}
