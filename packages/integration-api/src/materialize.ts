/**
 * Shared materialize session for host integrations.
 *
 * Centralizes cwd/roots resolution, required-root checks, and report assembly
 * that every host otherwise repeats.
 */

import { join, resolve } from "node:path";
import type {
  AttributedPrimitive,
  AttributedPrimitiveSet,
  DeployedFile,
  MaterializeContext,
  MaterializeReport,
  TargetId,
} from "./types.ts";
import { requireDeployRoots } from "./paths.ts";
import { materializeSkill } from "./helpers.ts";
import type { PrimitiveMaterializeHandlers } from "./helpers.ts";
import type { MaterializeDiagnostic } from "./hooks.ts";

export type MaterializeRun = {
  primitives: AttributedPrimitiveSet;
  cwd: string;
  roots: string[];
  deployedFiles: DeployedFile[];
  diagnostics: NonNullable<MaterializeReport["diagnostics"]>;
  report(): MaterializeReport;
};

export type CreateMaterializeRunArgs = {
  primitives: AttributedPrimitiveSet;
  ctx?: MaterializeContext;
  defaultDeployRoots: readonly string[];
  targetId: TargetId;
  requiredRoots?: readonly string[];
  /** Label used in required-root errors; defaults to `targetId`. */
  label?: string;
};

/**
 * Create a materialize run with resolved cwd/roots and mutable report arrays.
 * Hosts push into `deployedFiles` / `diagnostics` and return `report()`.
 */
export function createMaterializeRun(args: CreateMaterializeRunArgs): MaterializeRun {
  const cwd = resolve(args.ctx?.cwd ?? process.cwd());
  const roots = args.ctx?.deployRoots?.length
    ? [...args.ctx.deployRoots]
    : [...args.defaultDeployRoots];
  if (args.requiredRoots?.length) {
    requireDeployRoots(roots, args.requiredRoots, args.label ?? args.targetId);
  }

  const deployedFiles: DeployedFile[] = [];
  const diagnostics: NonNullable<MaterializeReport["diagnostics"]> = [];

  return {
    primitives: args.primitives,
    cwd,
    roots,
    deployedFiles,
    diagnostics,
    report(): MaterializeReport {
      return {
        targetId: args.targetId,
        deployedFiles,
        ...(diagnostics.length > 0 ? { diagnostics } : {}),
      };
    },
  };
}

export type UnsupportedPrimitiveArgs = {
  code: string;
  /** Host label used in the message. */
  label: string;
  primitive: AttributedPrimitive;
  kind: string;
  hint?: string;
};

/** Build the standard "host does not materialize this kind" diagnostic. */
export function unsupportedPrimitiveDiagnostic(
  args: UnsupportedPrimitiveArgs,
): MaterializeDiagnostic {
  const hint = args.hint ? ` (${args.hint})` : "";
  return {
    code: args.code,
    message: `${args.label} does not materialize ${args.kind} primitives as host files: "${args.primitive.name}"${hint}`,
    primitive: String(args.primitive.name),
    kind: args.kind,
  };
}

export type SkillsOnlyHandlersArgs = {
  cwd: string;
  deployRoots: string[];
  /** Base skill directory, e.g. `.agents/skills` or `agent-data/workflows`. */
  destDir: string;
  code: string;
  label: string;
  deployedFiles: DeployedFile[];
  diagnostics: MaterializeDiagnostic[];
  instructionsHint?: string;
};

/**
 * Build handlers for hosts that deploy skills only and emit non-fatal
 * diagnostics for every other primitive kind.
 */
export function skillsOnlyHandlers(args: SkillsOnlyHandlersArgs): PrimitiveMaterializeHandlers {
  const skip = (primitive: AttributedPrimitive, kind: string): void => {
    args.diagnostics.push({
      code: args.code,
      message: `${args.label} supports skills only; skipped ${kind} primitive: "${primitive.name}"${
        args.instructionsHint && kind === "instruction" ? ` (${args.instructionsHint})` : ""
      }`,
      primitive: String(primitive.name),
      kind,
    });
  };

  return {
    skill(primitive, { name }) {
      args.deployedFiles.push(
        ...materializeSkill({
          primitive,
          cwd: args.cwd,
          deployRoots: args.deployRoots,
          destDir: join(args.destDir, name),
        }),
      );
    },
    instruction(primitive) {
      skip(primitive, "instruction");
    },
    agent(primitive) {
      skip(primitive, "agent");
    },
    command(primitive) {
      skip(primitive, "command");
    },
    hook(primitive) {
      skip(primitive, "hook");
    },
    unknown(primitive, { type }) {
      skip(primitive, type || "unknown");
    },
  };
}
