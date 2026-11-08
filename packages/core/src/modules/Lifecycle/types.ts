import type { BapmManifest } from "@/modules/Manifest";
import type { ResolvedNode } from "@/modules/Resolver";

/** Non-fatal diagnostic for an ignored `lifecycle:` block. */
export type LifecycleUnsupportedDiagnostic = {
  code: "LIFECYCLE_UNSUPPORTED";
  message: string;
  packageName: string;
  /** Package root that declared the block (absent for the root manifest). */
  path?: string;
  root: boolean;
  warn: true;
};

export type DetectLifecycleUnsupportedOptions = {
  /** Effective root manifest (local overlay already merged). */
  rootManifest?: BapmManifest;
  /** Resolved dependency nodes with materialized package roots. */
  nodes?: readonly ResolvedNode[];
};
