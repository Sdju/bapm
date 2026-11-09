/**
 * Shared compile helper for hosts that emit deterministic markdown (AGENTS.md family).
 */

import type {
  AttributedPrimitive,
  AttributedPrimitiveSet,
  CompileContext,
  CompileReport,
} from "./types.ts";
import { compileMarkdownReport, primitivesList, renderPrimitivesMarkdown } from "./helpers.ts";

/** How instruction primitives participate in a markdown compile output. */
export type InstructionCompileMode = "include" | "omit" | "only";

export type CompilePrimitivesMarkdownOptions = {
  /** Document title, e.g. `# AGENTS.md`. */
  title: string;
  /** Output path used when `context.outputFile` is absent. */
  defaultOutput: string;
  /** Instruction handling; default `include`. */
  instructions?: InstructionCompileMode;
  /** Optional output basename gate. */
  requireBasename?: string;
  /** Placeholder when no primitives remain after filtering. */
  emptyMessage?: string;
  /** Section heading override. */
  sectionHeading?: (primitive: AttributedPrimitive) => string;
  /** Error message when the output escapes `cwd`. */
  outsideCwdMessage?: string;
};

/**
 * Render attributed primitives to markdown and return a `CompileReport`.
 *
 * Centralizes the repeated render + report pair used by markdown-family hosts.
 * `omit` renders instructions when core requests distributed placement via
 * `context.includeInstructions`.
 */
export function compilePrimitivesMarkdown(
  primitives: AttributedPrimitiveSet,
  context: CompileContext,
  options: CompilePrimitivesMarkdownOptions,
): CompileReport {
  const mode = options.instructions ?? "include";
  const includeInstructions = context.includeInstructions === true;

  const filter =
    mode === "include"
      ? undefined
      : (primitive: AttributedPrimitive): boolean => {
          const isInstruction = /instruction/i.test(String(primitive.type ?? ""));
          if (mode === "only") return isInstruction;
          return includeInstructions || !isInstruction;
        };

  const content = renderPrimitivesMarkdown({
    primitives: primitivesList(primitives),
    title: options.title,
    ...(filter ? { filter } : {}),
    ...(options.emptyMessage !== undefined ? { emptyMessage: options.emptyMessage } : {}),
    ...(options.sectionHeading ? { sectionHeading: options.sectionHeading } : {}),
  });

  return compileMarkdownReport({
    cwd: context.cwd,
    outputFile: context.outputFile ?? options.defaultOutput,
    write: context.write,
    content,
    ...(options.requireBasename ? { requireBasename: options.requireBasename } : {}),
    ...(options.outsideCwdMessage ? { outsideCwdMessage: options.outsideCwdMessage } : {}),
  });
}
