/**
 * CycloneDX 1.5 / SPDX 2.3 serializers from lock inventory (APM-aligned).
 */

import {
  classifyDeclaredLicense,
  KIND_EXPRESSION,
  KIND_ID,
} from "./license.ts";
import { buildPurl, componentName, componentVersion, scrubUrl } from "./purl.ts";
import {
  CYCLONEDX_SPEC_VERSION,
  FORMAT_CYCLONEDX,
  FORMAT_SPDX,
  SPDX_VERSION,
  SUPPORTED_FORMATS,
  type InventoryDep,
  type LockfileDocument,
  type LockfileInput,
  type SbomFormat,
} from "./types.ts";

const NOASSERTION = "NOASSERTION";

function asDeps(document: LockfileDocument | LockfileInput): InventoryDep[] {
  const raw = document as Record<string, unknown>;
  const deps = raw.dependencies;
  if (Array.isArray(deps)) return deps as InventoryDep[];
  if (deps && typeof deps === "object") return Object.values(deps) as InventoryDep[];
  return [];
}

function isSyntheticSelf(dep: InventoryDep): boolean {
  const repo = String(dep.repo_url ?? "");
  return (
    repo === "<self>" ||
    repo === "." ||
    dep.virtual_path === "." ||
    dep.local_path === "."
  );
}

function sortedDeps(document: LockfileDocument | LockfileInput): Array<[string, InventoryDep]> {
  const pairs: Array<[string, InventoryDep]> = [];
  for (const dep of asDeps(document)) {
    if (isSyntheticSelf(dep)) continue;
    if (!dep.repo_url) continue;
    pairs.push([buildPurl(dep), dep]);
  }
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return pairs;
}

function cyclonedxLicenses(
  declared: string | undefined,
): Array<Record<string, unknown>> | undefined {
  if (!declared) return undefined;
  const result = classifyDeclaredLicense(declared);
  if (result.kind === KIND_ID) return [{ license: { id: result.value } }];
  if (result.kind === KIND_EXPRESSION) return [{ expression: result.value }];
  return [{ license: { name: result.value } }];
}

function spdxLicenseDeclared(declared: string | undefined): string {
  if (!declared) return NOASSERTION;
  return declared;
}

function externalReferences(dep: InventoryDep): Array<{ type: string; url: string }> {
  if (!dep.resolved_url) return [];
  return [{ type: "distribution", url: scrubUrl(String(dep.resolved_url)) }];
}

function buildCyclonedx(
  document: LockfileDocument | LockfileInput,
  timestamp: string,
): Record<string, unknown> {
  const components: Array<Record<string, unknown>> = [];
  for (const [purl, dep] of sortedDeps(document)) {
    const comp: Record<string, unknown> = {
      type: "library",
      name: componentName(dep),
      purl,
      "bom-ref": purl,
    };
    const version = componentVersion(dep);
    if (version) comp.version = version;
    const licenses = cyclonedxLicenses(
      typeof dep.declared_license === "string" ? dep.declared_license : undefined,
    );
    if (licenses !== undefined) comp.licenses = licenses;
    const refs = externalReferences(dep);
    if (refs.length > 0) comp.externalReferences = refs;
    components.push(comp);
  }
  return {
    bomFormat: "CycloneDX",
    specVersion: CYCLONEDX_SPEC_VERSION,
    version: 1,
    metadata: {
      timestamp,
      tools: [{ vendor: "bapm", name: "bapm lock export" }],
    },
    components,
  };
}

function buildSpdx(
  document: LockfileDocument | LockfileInput,
  timestamp: string,
): Record<string, unknown> {
  const packages: Array<Record<string, unknown>> = [];
  for (const [index, [purl, dep]] of sortedDeps(document).entries()) {
    const download = dep.resolved_url
      ? scrubUrl(String(dep.resolved_url)) || NOASSERTION
      : NOASSERTION;
    const pkg: Record<string, unknown> = {
      SPDXID: `SPDXRef-Package-${index}`,
      name: componentName(dep),
      downloadLocation: download,
      licenseConcluded: NOASSERTION,
      licenseDeclared: spdxLicenseDeclared(
        typeof dep.declared_license === "string" ? dep.declared_license : undefined,
      ),
      externalRefs: [
        {
          referenceCategory: "PACKAGE-MANAGER",
          referenceType: "purl",
          referenceLocator: purl,
        },
      ],
    };
    const version = componentVersion(dep);
    if (version) pkg.versionInfo = version;
    packages.push(pkg);
  }
  return {
    spdxVersion: SPDX_VERSION,
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: "bapm-sbom",
    documentNamespace: `https://spdx.org/spdxdocs/bapm-sbom-${timestamp}`,
    creationInfo: {
      created: timestamp,
      creators: ["Tool: bapm lock export"],
    },
    packages,
  };
}

export function normalizeFormat(fmt: string | undefined): SbomFormat | null {
  const normalized = (fmt ?? FORMAT_CYCLONEDX).toLowerCase();
  if (normalized === FORMAT_CYCLONEDX || normalized === FORMAT_SPDX) return normalized;
  return null;
}

export function formatUnsupportedMessage(fmt: string): string {
  return `Unsupported SBOM format: ${JSON.stringify(fmt)}. Use one of ${SUPPORTED_FORMATS.join(", ")}.`;
}

/** Serialize lock inventory to deterministic SBOM JSON (indent 2, sorted keys, trailing newline). */
export function serializeSbom(
  document: LockfileDocument | LockfileInput,
  format: SbomFormat,
  timestamp: string,
): string {
  const doc =
    format === FORMAT_SPDX
      ? buildSpdx(document, timestamp)
      : buildCyclonedx(document, timestamp);
  return `${stableStringify(doc, 2)}\n`;
}

function stableStringify(value: unknown, space: number): string {
  return JSON.stringify(sortKeysDeep(value), null, space);
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeysDeep(obj[key]);
    }
    return out;
  }
  return value;
}
