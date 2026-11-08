/**
 * LspCanvas — explicit diagnostics for parsed-but-undeployable LSP/canvas declarations.
 *
 * ## Public API
 *
 * - `detectLspUnsupported` / `detectCanvasUnsupported`
 * - `detectUnsupportedDeclarations` / `collectUnsupportedDeclarations`
 *
 * ## Example
 *
 * ```ts
 * import { detectUnsupportedDeclarations } from "@/modules/LspCanvas";
 * const diagnostics = detectUnsupportedDeclarations({ rootManifest, nodes, primitives });
 * ```
 */

export type {
  CanvasUnsupportedDiagnostic,
  DetectCanvasUnsupportedOptions,
  DetectLspUnsupportedOptions,
  DetectUnsupportedDeclarationsOptions,
  LspUnsupportedDiagnostic,
  UnsupportedDeclarationDiagnostic,
} from "./types.ts";
export {
  collectUnsupportedDeclarations,
  detectCanvasUnsupported,
  detectLspUnsupported,
  detectUnsupportedDeclarations,
} from "./detect.ts";
