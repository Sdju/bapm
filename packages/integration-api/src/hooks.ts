/**
 * Shared hook-source and event-name helpers for host integrations.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { AttributedPrimitive, DeployedFile, MaterializeReport } from "./types.ts";
import { readJsonDocument, writeJsonDocument } from "./config.ts";
import {
  copyHookScript,
  readHookOwnershipSidecar,
  removeOwnedHookArtifacts,
  renderNativeHookEntries,
  sanitizeName,
  stripOwnedHookCommands,
  writeHookOwnershipSidecar,
} from "./helpers.ts";
import type { HookOwnershipSidecar } from "./helpers.ts";

export type MaterializeDiagnostic = NonNullable<MaterializeReport["diagnostics"]>[number];

export type ReadHookSourceOptions = {
  missingCode?: string;
  invalidCode?: string;
};

export type HookSourceReadResult = {
  hooks: Record<string, unknown[]>;
  version?: number;
  diagnostics: MaterializeDiagnostic[];
};

/** Normalize a hook event name to camelCase or PascalCase. */
export function normalizeHookEventName(event: string, style: "camel" | "pascal"): string {
  const trimmed = String(event ?? "").trim();
  if (!trimmed) return trimmed;

  const parts = trimmed.split(/[-_\s]+/).filter(Boolean);
  if (parts.length <= 1 && !trimmed.includes("_") && !trimmed.includes("-")) {
    return style === "camel"
      ? trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
      : trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  return parts
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (style === "camel" && index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

/**
 * Read a hook primitive's source JSON and return its `hooks` map.
 * Missing or malformed sources produce host-prefixed diagnostics instead of throwing.
 */
export function readHookSource(
  primitive: AttributedPrimitive,
  options: ReadHookSourceOptions = {},
): HookSourceReadResult {
  const diagnostics: MaterializeDiagnostic[] = [];
  const srcPath = primitive.path ? resolve(primitive.path) : undefined;
  if (!srcPath || !existsSync(srcPath) || !statSync(srcPath).isFile()) {
    diagnostics.push({
      code: options.missingCode ?? "HOOK_SOURCE_MISSING",
      message: `Hook primitive "${primitive.name}" has no readable source JSON`,
      primitive: String(primitive.name),
    });
    return { hooks: {}, diagnostics };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(srcPath, "utf8"));
  } catch (cause) {
    diagnostics.push({
      code: options.invalidCode ?? "HOOK_JSON_INVALID",
      message: `Hook "${primitive.name}" JSON is invalid: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      primitive: String(primitive.name),
    });
    return { hooks: {}, diagnostics };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    diagnostics.push({
      code: options.invalidCode ?? "HOOK_JSON_INVALID",
      message: `Hook "${primitive.name}" JSON must contain an object`,
      primitive: String(primitive.name),
    });
    return { hooks: {}, diagnostics };
  }

  const record = parsed as { hooks?: Record<string, unknown[]>; version?: number };
  return {
    hooks: record.hooks && typeof record.hooks === "object" ? record.hooks : {},
    ...(typeof record.version === "number" ? { version: record.version } : {}),
    diagnostics,
  };
}

export type HookDeploymentMode = "flat" | "native-groups";

export type HookScriptDestinationArgs = {
  name: string;
  event: string;
  command: string;
  primitive: AttributedPrimitive;
  packageKey?: string;
};

export type MergeHookDeploymentArgs = {
  cwd: string;
  deployRoots: string[];
  hooks: AttributedPrimitive[];
  /** Absolute or cwd-relative path to the host hooks document. */
  docPath: string;
  ownershipPath: string;
  /** Project-relative inventory path for the hooks document. */
  docRel: string;
  ownershipRel: string;
  /** `flat` rewrites entries in place; `native-groups` uses matcher groups. */
  mode: HookDeploymentMode;
  /** Diagnostic code prefix, e.g. `CURSOR`. */
  code: string;
  normalizeEvent?: (event: string) => string;
  defaultMatcher?: string;
  defaultHandlerType?: boolean;
  alreadyDeployedNeedle: string;
  scriptDestRel: (args: HookScriptDestinationArgs) => string;
  commandAsDotSlash?: boolean;
  /** Strip `_apm_source` from flat entries; default true. */
  stripOwnershipKey?: boolean;
  /** Flat-mode entry transform before command rewriting. */
  transformEntry?: (entry: Record<string, unknown>, event: string) => Record<string, unknown>;
  /** Propagate a source `version` into the doc; default true. */
  propagateVersion?: boolean;
  /** Default `version` written when absent. */
  versionDefault?: number;
  packageKey?: (primitive: AttributedPrimitive) => string;
  /** Delete previously owned script/hook files before merging; default false. */
  removeOwnedArtifacts?: boolean;
};

export type MergeHookDeploymentResult = {
  document: Record<string, unknown>;
  deployedFiles: DeployedFile[];
  diagnostics: MaterializeDiagnostic[];
};

/**
 * Merge hook primitives into one host hooks document, maintaining the
 * ownership sidecar and deployment inventory.
 *
 * Hosts choose the document paths, event normalization, entry shape, and
 * script destination; the merge/cleanup/write pipeline is shared.
 */
export function mergeHookDeployment(args: MergeHookDeploymentArgs): MergeHookDeploymentResult {
  const deployedFiles: DeployedFile[] = [];
  const diagnostics: MaterializeDiagnostic[] = [];
  const doc = readJsonDocument({ path: args.docPath });
  const ownership = readHookOwnershipSidecar(args.ownershipPath);
  if (args.removeOwnedArtifacts) removeOwnedHookArtifacts(args.cwd, ownership);

  const hooksMap: Record<string, unknown[]> =
    doc.hooks && typeof doc.hooks === "object" && !Array.isArray(doc.hooks)
      ? { ...(doc.hooks as Record<string, unknown[]>) }
      : {};
  stripOwnedHookCommands(hooksMap, ownership);
  doc.hooks = hooksMap;

  const nextOwned: HookOwnershipSidecar["owned"] = {};

  for (const primitive of args.hooks) {
    const name = sanitizeName(String(primitive.name));
    const source = readHookSource(primitive, {
      missingCode: `${args.code}_HOOK_SOURCE_MISSING`,
      invalidCode: `${args.code}_HOOK_JSON_INVALID`,
    });
    if (source.diagnostics.length > 0) {
      diagnostics.push(...source.diagnostics);
      continue;
    }

    const srcPath = resolve(primitive.path!);
    const packageKey = args.packageKey ? args.packageKey(primitive) : undefined;
    const ownedEntries: Array<{ event: string; command: string }> = [];
    const scripts: string[] = [];

    if (
      args.propagateVersion !== false &&
      typeof source.version === "number" &&
      doc.version === undefined
    ) {
      doc.version = source.version;
    }

    for (const [rawEvent, entries] of Object.entries(source.hooks)) {
      if (!Array.isArray(entries)) continue;
      const event = args.normalizeEvent ? args.normalizeEvent(rawEvent) : rawEvent;
      const existing = Array.isArray(hooksMap[event]) ? [...hooksMap[event]!] : [];

      if (args.mode === "native-groups") {
        const rendered = renderNativeHookEntries({
          entries,
          ...(args.defaultMatcher !== undefined ? { defaultMatcher: args.defaultMatcher } : {}),
          ...(args.defaultHandlerType !== undefined
            ? { defaultHandlerType: args.defaultHandlerType }
            : {}),
          rewriteCommand: (command) => {
            const rewritten = copyHookScript({
              cwd: args.cwd,
              deployRoots: args.deployRoots,
              hookFile: srcPath,
              command,
              alreadyDeployedNeedle: args.alreadyDeployedNeedle,
              destRel: args.scriptDestRel({
                name,
                event,
                command,
                primitive,
                ...(packageKey ? { packageKey } : {}),
              }),
              commandAsDotSlash: args.commandAsDotSlash ?? false,
            });
            return {
              command: rewritten.commandRel,
              ...(rewritten.scriptRel ? { scriptRel: rewritten.scriptRel } : {}),
            };
          },
        });
        for (const owned of rendered.owned) ownedEntries.push({ event, command: owned.command });
        for (const scriptRel of rendered.scripts) {
          if (scripts.includes(scriptRel)) continue;
          scripts.push(scriptRel);
          deployedFiles.push({
            path: scriptRel,
            primitive: { name: String(primitive.name), packageName: primitive.packageName },
          });
        }
        hooksMap[event] = [...existing, ...rendered.entries];
        continue;
      }

      const flat = [...existing];
      for (const rawEntry of entries) {
        if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
          flat.push(rawEntry);
          continue;
        }
        const clean = { ...(rawEntry as Record<string, unknown>) };
        if (args.stripOwnershipKey !== false) delete clean._apm_source;
        const entry = args.transformEntry ? args.transformEntry(clean, event) : clean;
        const command = typeof entry.command === "string" ? entry.command.trim() : "";
        if (!command) {
          flat.push({ ...entry });
          continue;
        }

        const rewritten = copyHookScript({
          cwd: args.cwd,
          deployRoots: args.deployRoots,
          hookFile: srcPath,
          command,
          alreadyDeployedNeedle: args.alreadyDeployedNeedle,
          destRel: args.scriptDestRel({
            name,
            event,
            command,
            primitive,
            ...(packageKey ? { packageKey } : {}),
          }),
          commandAsDotSlash: args.commandAsDotSlash ?? false,
        });
        flat.push({ ...entry, command: rewritten.commandRel });
        ownedEntries.push({ event, command: rewritten.commandRel });
        if (rewritten.scriptRel) {
          scripts.push(rewritten.scriptRel);
          deployedFiles.push({
            path: rewritten.scriptRel,
            primitive: { name: String(primitive.name), packageName: primitive.packageName },
          });
        }
      }
      hooksMap[event] = flat;
    }

    nextOwned[name] = {
      ...(primitive.packageName ? { packageName: primitive.packageName } : {}),
      entries: ownedEntries,
      scripts,
    };
  }

  if (doc.version === undefined && args.versionDefault !== undefined) {
    doc.version = args.versionDefault;
  }
  writeJsonDocument(args.docPath, doc);
  writeHookOwnershipSidecar(args.ownershipPath, { owned: nextOwned });

  const first = args.hooks[0];
  deployedFiles.push({
    path: args.docRel,
    ...(first ? { primitive: { name: String(first.name), packageName: first.packageName } } : {}),
  });
  deployedFiles.push({
    path: args.ownershipRel,
    ...(first ? { primitive: { name: String(first.name), packageName: first.packageName } } : {}),
  });

  return { document: doc, deployedFiles, diagnostics };
}
