import {
  createDefaultDownloader,
  createDefaultGitRemote,
  createDefaultTagLister,
  runInstall as coreRunInstall,
} from "@bapm/core";
import { createTargetRegistry } from "bapm-target-api";
import { createCursorTarget } from "bapm-target-cursor";
import type { InstallDeps, InstallOptions, InstallResult } from "../types/install.types.ts";

export function parseInstallArgs(argv: string[]): {
  frozen: boolean;
  update: boolean;
  error?: string;
} {
  let frozen = false;
  let update = false;

  for (const arg of argv) {
    if (arg === "--frozen") {
      frozen = true;
      continue;
    }
    if (arg === "--update") {
      update = true;
      continue;
    }
    if (arg.startsWith("-")) {
      // Soft-ignore unknown flags for M4 subset
      continue;
    }
  }

  if (frozen && update) {
    return {
      frozen,
      update,
      error: "Frozen mode rejects --update (frozen+update mutation rejected)",
    };
  }

  return { frozen, update };
}

export async function runInstall(
  deps: InstallDeps,
  options: InstallOptions,
): Promise<InstallResult> {
  const parsed = parseInstallArgs(options.args ?? []);
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, message: parsed.error };
  }

  const registry = createTargetRegistry();
  registry.register(createCursorTarget());

  try {
    await coreRunInstall({
      cwd: options.cwd,
      frozen: parsed.frozen,
      updateRefs: parsed.update,
      update: parsed.update,
      targetRegistry: registry,
      gitRemote: createDefaultGitRemote(),
      tagLister: createDefaultTagLister(),
      downloader: createDefaultDownloader(),
    });
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
