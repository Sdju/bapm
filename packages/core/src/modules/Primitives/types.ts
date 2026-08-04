export type PrimitiveSource = "local" | `dependency:${string}`;

export type PrimitiveType = string;

export type AttributedPrimitive = {
  name: string;
  type: PrimitiveType;
  source: PrimitiveSource;
  path: string;
  packageName?: string;
  content?: string;
  [key: string]: unknown;
};

export type DiscoverPrimitivesOptions = {
  cwd?: string;
  /** Modules root; defaults to `<cwd>/apm_modules`. */
  modulesDir?: string;
  /** Declaration order of dependency package names (pr-003). */
  declarationOrder?: string[];
};

export type PrimitiveConflictDiagnostic = {
  code: string;
  message: string;
  name: string;
  type: string;
  winnerSource: string;
  loserSource: string;
};

export type ResolvePrimitiveConflictsOptions = {
  primitives: AttributedPrimitive[];
  cwd?: string;
  declarationOrder?: string[];
};

export type ResolvePrimitiveConflictsResult = {
  primitives: AttributedPrimitive[];
  diagnostics: PrimitiveConflictDiagnostic[];
};
