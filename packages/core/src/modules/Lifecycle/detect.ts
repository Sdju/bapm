import { existsSync } from "node:fs";
import { loadManifest } from "@/modules/Manifest";
import type { DetectLifecycleUnsupportedOptions, LifecycleUnsupportedDiagnostic } from "./types.ts";

/** True when the manifest retains a top-level `lifecycle` key with a value. */
export function hasLifecycleDeclaration(document: unknown): boolean {
  if (!document || typeof document !== "object" || Array.isArray(document)) return false;
  const record = document as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(record, "lifecycle") && record.lifecycle != null;
}

function diagnostic(args: {
  packageName: string;
  root: boolean;
  path?: string;
}): LifecycleUnsupportedDiagnostic {
  const name = args.packageName.trim() || "(unnamed package)";
  return {
    code: "LIFECYCLE_UNSUPPORTED",
    message:
      `LIFECYCLE_UNSUPPORTED: Package "${name}" declares a "lifecycle" block; ` +
      "bapm retains the key but does not execute lifecycle commands. " +
      'Remove "lifecycle" or run the steps manually.',
    packageName: name,
    ...(args.path ? { path: args.path } : {}),
    root: args.root,
    warn: true,
  };
}

/**
 * Detect root + dependency package manifests that declare `lifecycle:`.
 * Read-only and best-effort: unreadable dependency manifests are skipped.
 * Nothing is executed. Diagnostics are deduped by package name.
 */
export function detectLifecycleUnsupported(
  options: DetectLifecycleUnsupportedOptions = {},
): LifecycleUnsupportedDiagnostic[] {
  const out: LifecycleUnsupportedDiagnostic[] = [];
  const seen = new Set<string>();
  const add = (packageName: string, root: boolean, path?: string) => {
    const name = packageName.trim() || "(unnamed package)";
    if (seen.has(name)) return;
    seen.add(name);
    out.push(diagnostic({ packageName: name, root, path }));
  };

  if (options.rootManifest && hasLifecycleDeclaration(options.rootManifest)) {
    add(options.rootManifest.name, true);
  }

  for (const node of options.nodes ?? []) {
    const packageRoot = node.packageRoot;
    if (!packageRoot || !existsSync(packageRoot)) continue;
    try {
      const { document } = loadManifest({ cwd: packageRoot });
      if (hasLifecycleDeclaration(document)) {
        add(document.name || node.name, false, packageRoot);
      }
    } catch {
      // A dependency manifest that cannot be loaded is handled by resolve/install.
    }
  }

  return out;
}

/** Alias matching the diagnostic-code vocabulary. */
export const collectLifecycleUnsupported = detectLifecycleUnsupported;
