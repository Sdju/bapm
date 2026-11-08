import { existsSync } from "node:fs";
import { loadManifest, type BapmManifest } from "@/modules/Manifest";
import type { AttributedPrimitive } from "@/modules/Primitives";
import type {
  CanvasUnsupportedDiagnostic,
  DetectCanvasUnsupportedOptions,
  DetectLspUnsupportedOptions,
  DetectUnsupportedDeclarationsOptions,
  LspUnsupportedDiagnostic,
  UnsupportedDeclarationDiagnostic,
} from "./types.ts";

type ManifestOwner = {
  packageName: string;
  root: boolean;
  path?: string;
  document: BapmManifest;
};

const DEPENDENCY_BLOCKS = ["dependencies", "devDependencies"] as const;

/**
 * Detect `dependencies.lsp` / `devDependencies.lsp` declarations on the root
 * manifest and dependency package manifests. bapm keeps the entries for
 * round-trip but does not deploy LSP servers.
 */
export function detectLspUnsupported(
  options: DetectLspUnsupportedOptions = {},
): LspUnsupportedDiagnostic[] {
  if (options.lspDeployable === true) return [];
  return lspDiagnosticsFromOwners(collectManifestOwners(options));
}

/**
 * Detect a manifest `canvas:` key and `canvas` primitives. Canvas has no
 * materialize path and stays outside the executable trust gates.
 */
export function detectCanvasUnsupported(
  options: DetectCanvasUnsupportedOptions = {},
): CanvasUnsupportedDiagnostic[] {
  const manifests = canvasManifestDiagnostics(collectManifestOwners(options));
  return [...manifests, ...canvasPrimitiveDiagnostics(options.primitives ?? [])];
}

/**
 * Combined install diagnostic surface for declarations bapm cannot deploy.
 * Dependency manifests are loaded once for both LSP and canvas detection.
 */
export function detectUnsupportedDeclarations(
  options: DetectUnsupportedDeclarationsOptions = {},
): UnsupportedDeclarationDiagnostic[] {
  const owners = collectManifestOwners(options);
  return [
    ...(options.lspDeployable === true ? [] : lspDiagnosticsFromOwners(owners)),
    ...canvasManifestDiagnostics(owners),
    ...canvasPrimitiveDiagnostics(options.primitives ?? []),
  ];
}

/** Alias matching the diagnostic-code vocabulary used by Lifecycle. */
export const collectUnsupportedDeclarations = detectUnsupportedDeclarations;

function collectManifestOwners(options: DetectLspUnsupportedOptions): ManifestOwner[] {
  const owners: ManifestOwner[] = [];
  const seenNames = new Set<string>();
  const seenRoots = new Set<string>();

  if (options.rootManifest) {
    const name = ownerName(options.rootManifest.name, "root");
    seenNames.add(name);
    owners.push({ packageName: name, root: true, document: options.rootManifest });
  }

  for (const node of options.nodes ?? []) {
    const packageRoot = node.packageRoot;
    if (!packageRoot || !existsSync(packageRoot)) continue;
    if (seenRoots.has(packageRoot)) continue;
    seenRoots.add(packageRoot);
    try {
      const { document } = loadManifest({ cwd: packageRoot });
      const name = ownerName(document.name || node.name, node.name || "dependency");
      if (seenNames.has(name)) continue;
      seenNames.add(name);
      owners.push({ packageName: name, root: false, path: packageRoot, document });
    } catch {
      // A dependency manifest that cannot be loaded is handled by resolve/install.
    }
  }

  return owners;
}

function ownerName(value: unknown, fallback: string): string {
  const name = typeof value === "string" ? value.trim() : "";
  return name || fallback;
}

function lspDiagnosticsFromOwners(owners: ManifestOwner[]): LspUnsupportedDiagnostic[] {
  const out: LspUnsupportedDiagnostic[] = [];
  for (const owner of owners) {
    const servers = lspServerLabels(owner.document);
    if (servers.length === 0) continue;
    out.push({
      code: "LSP_UNSUPPORTED",
      message:
        `LSP_UNSUPPORTED: Package "${owner.packageName}" declares LSP server(s) ` +
        `[${servers.join(", ")}] under dependencies.lsp; bapm parses the entries but does not ` +
        "deploy LSP servers. Remove dependencies.lsp or configure the LSP server manually in your host.",
      packageName: owner.packageName,
      ...(owner.path ? { path: owner.path } : {}),
      root: owner.root,
      servers,
      deploy: false,
      executableType: "lsp",
      unsupported: true,
      warn: true,
    });
  }
  return out;
}

function lspServerLabels(document: BapmManifest): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const blockName of DEPENDENCY_BLOCKS) {
    const block = asRecord(document[blockName]);
    if (!block || !("lsp" in block)) continue;
    for (const entry of lspEntries(block.lsp)) {
      const label = lspEntryLabel(entry, labels.length);
      if (seen.has(label)) continue;
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
}

/** A declared LSP list is non-empty when it carries at least one entry. */
function lspEntries(value: unknown): unknown[] {
  if (value === undefined || value === null || value === false) return [];
  if (Array.isArray(value)) {
    return value.filter((entry) => entry !== undefined && entry !== null && entry !== false);
  }
  if (isPlainObject(value)) {
    return Object.keys(value).length > 0 ? [value] : [];
  }
  return [value];
}

/** Best-effort server label for a diagnostic; never drops the declaration. */
function lspEntryLabel(entry: unknown, index: number): string {
  if (typeof entry === "string") {
    return entry.trim() || `#${index + 1}`;
  }
  if (isPlainObject(entry)) {
    for (const key of ["name", "server", "id", "label", "command"] as const) {
      const candidate = entry[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }
  return `#${index + 1}`;
}

function canvasManifestDiagnostics(owners: ManifestOwner[]): CanvasUnsupportedDiagnostic[] {
  const out: CanvasUnsupportedDiagnostic[] = [];
  for (const owner of owners) {
    if (!hasCanvasDeclaration(owner.document)) continue;
    out.push({
      code: "CANVAS_UNSUPPORTED",
      message:
        `CANVAS_UNSUPPORTED: Package "${owner.packageName}" declares a "canvas" key; ` +
        "bapm does not implement canvas primitives and does not deploy them. " +
        'Remove "canvas" or use APM for this project.',
      packageName: owner.packageName,
      ...(owner.path ? { path: owner.path } : {}),
      root: owner.root,
      source: "manifest",
      deploy: false,
      unsupported: true,
      warn: true,
    });
  }
  return out;
}

function hasCanvasDeclaration(document: BapmManifest): boolean {
  const record = document as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, "canvas")) return false;
  const value = record.canvas;
  // `canvas: null` / `canvas: false` carry no request to deploy.
  return value !== undefined && value !== null && value !== false;
}

function canvasPrimitiveDiagnostics(
  primitives: readonly AttributedPrimitive[],
): CanvasUnsupportedDiagnostic[] {
  const out: CanvasUnsupportedDiagnostic[] = [];
  const seen = new Set<string>();
  for (const primitive of primitives) {
    if (String(primitive.type).toLowerCase() !== "canvas") continue;
    const key = `${primitive.source}\u0000${primitive.path}\u0000${primitive.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const packageName = primitive.packageName?.trim() || packageFromSource(primitive.source);
    out.push({
      code: "CANVAS_UNSUPPORTED",
      message:
        `CANVAS_UNSUPPORTED: Canvas primitive "${primitive.name}" from "${primitive.source}" ` +
        "was not deployed because bapm does not implement canvas primitives. " +
        "Canvas remains outside the executable trust gates until it is implemented.",
      packageName,
      path: primitive.path,
      root: primitive.source === "local",
      source: "primitive",
      primitive: primitive.name,
      primitiveSource: primitive.source,
      deploy: false,
      unsupported: true,
      warn: true,
    });
  }
  return out;
}

function packageFromSource(source: string): string {
  if (source.startsWith("dependency:")) return source.slice("dependency:".length) || "dependency";
  return "local";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isPlainObject(value) ? value : undefined;
}
