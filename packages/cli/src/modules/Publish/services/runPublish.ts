import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PublishDeps, PublishOptions, PublishResult } from "../types/publish.types.ts";

export function formatPublishHelp(deps: PublishDeps): string {
  return `${deps.name} publish — Publish a flat registry zip (experimental)

Usage:
  bapm publish [options]

Options:
  --dry-run                      Build/validate without PUT
  --zip <path>                   Upload a prebuilt archive (skip rebuild)
  --help, -h                     Show this help

Notes:
  Requires BAPM_EXPERIMENTAL_REGISTRIES=1 (experimental registries gate).
  Auth: set BAPM_REGISTRY_TOKEN (Bearer) for protected registries.
  Archive layout: apm.yml + .apm/ at zip root (distinct from M7 pack).
  Unknown flags are rejected.
`;
}

export function parsePublishArgs(argv: string[]): {
  dryRun: boolean;
  zipPath?: string;
  help?: boolean;
  error?: string;
} {
  let dryRun = false;
  let zipPath: string | undefined;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--zip") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return { dryRun, error: "Missing value for --zip <path>" };
      }
      zipPath = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--zip=")) {
      zipPath = arg.slice("--zip=".length);
      if (!zipPath) return { dryRun, error: "Missing value for --zip=<path>" };
      continue;
    }
    if (arg.startsWith("-")) {
      return { dryRun, zipPath, error: `Unknown publish flag: ${arg}` };
    }
    return { dryRun, zipPath, error: `Unexpected argument: ${arg}` };
  }

  return { dryRun, zipPath, help };
}

export async function runPublishCli(
  deps: PublishDeps,
  options: PublishOptions,
): Promise<PublishResult> {
  const parsed = parsePublishArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatPublishHelp(deps));
    return { ok: true };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, message: parsed.error };
  }

  const cwd = options.cwd;

  try {
    deps.assertExperimentalRegistriesEnabled({ action: "publish" });

    const { document } = deps.loadManifest({ cwd });
    const { baseUrl, registryName } = deps.resolveRegistryBaseUrl({
      registries: document.registries,
    });

    let bytes: Uint8Array;
    let owner: string;
    let repo: string;
    let version: string;

    if (parsed.zipPath) {
      const zipAbs = resolve(cwd, parsed.zipPath);
      bytes = new Uint8Array(readFileSync(zipAbs));
      const slash = document.name.indexOf("/");
      if (slash <= 0) {
        throw new Error(`Publish requires package name in owner/repo form; got "${document.name}"`);
      }
      owner = document.name.slice(0, slash);
      repo = document.name.slice(slash + 1);
      version = document.version;
    } else {
      const archive = await deps.buildPublishArchive({ cwd, dryRun: parsed.dryRun });
      bytes = archive.bytes;
      owner = archive.owner;
      repo = archive.repo;
      version = archive.version;
    }

    if (parsed.dryRun) {
      console.log(
        `Dry-run: would PUT ${bytes.byteLength} bytes to ${baseUrl}/v1/packages/${owner}/${repo}/versions/${version}`,
      );
      return { ok: true };
    }

    const client = deps.createRegistryClient({
      baseUrl,
      registryName,
    });
    await client.publish(owner, repo, version, bytes);
    console.log(`Published ${owner}/${repo}@${version}`);
    return { ok: true };
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
