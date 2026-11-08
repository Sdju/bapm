import type { BapmManifest } from "@/modules/Manifest";
import type { AttributedPrimitive } from "@/modules/Primitives";
import type { ResolvedNode } from "@/modules/Resolver";

/**
 * Non-fatal diagnostic for `dependencies.lsp` declarations that bapm parses
 * but does not deploy.
 */
export type LspUnsupportedDiagnostic = {
  code: "LSP_UNSUPPORTED";
  message: string;
  packageName: string;
  /** Package root that declared the block (absent for the root manifest). */
  path?: string;
  root: boolean;
  /** Server labels extracted from the LSP entries for the diagnostic. */
  servers: string[];
  /** LSP is not a deployable executable type in this release. */
  deploy: false;
  executableType: "lsp";
  unsupported: true;
  warn: true;
};

/**
 * Non-fatal diagnostic for a manifest `canvas:` key or a `canvas` primitive.
 * Canvas stays outside every trust gate until it is implemented.
 */
export type CanvasUnsupportedDiagnostic = {
  code: "CANVAS_UNSUPPORTED";
  message: string;
  packageName: string;
  /** Package root that declared the canvas key/primitive. */
  path?: string;
  root?: boolean;
  /** Where the declaration was found. */
  source: "manifest" | "primitive";
  /** Primitive name for `source: "primitive"`. */
  primitive?: string;
  /** Primitive source attribution for `source: "primitive"`. */
  primitiveSource?: string;
  deploy: false;
  unsupported: true;
  warn: true;
};

export type UnsupportedDeclarationDiagnostic =
  | LspUnsupportedDiagnostic
  | CanvasUnsupportedDiagnostic;

export type DetectLspUnsupportedOptions = {
  /** Effective root manifest (local overlay already merged). */
  rootManifest?: BapmManifest;
  /** Resolved dependency nodes with materialized package roots. */
  nodes?: readonly ResolvedNode[];
  /**
   * When true, at least one active host deploys LSP, so install must not emit
   * the `LSP_UNSUPPORTED` warning for the same declarations.
   */
  lspDeployable?: boolean;
};

export type DetectCanvasUnsupportedOptions = DetectLspUnsupportedOptions & {
  /** Resolved primitives; a `canvas` type is surfaced instead of silently dropped. */
  primitives?: readonly AttributedPrimitive[];
};

export type DetectUnsupportedDeclarationsOptions = DetectCanvasUnsupportedOptions;
