/**
 * Append actionable install guidance for unknown-target / missing-detect diagnostics.
 */
import {
  canonicalPackageSpecifier,
  isCanonicalHostId,
  probeCanonicalHostMarkers,
} from "@/common/canonicalHosts.ts";

const ALREADY_GUIDED =
  /@bapm\/integration-|install the (?:host )?integration|npm i |not installed or resolvable/i;

function extractUnregisteredId(message: string): string | undefined {
  const m = message.match(/unknown or unregistered target:\s*([^\s,;]+)/i);
  return m?.[1]?.replace(/[."']+$/, "");
}

function installHintFor(hostId: string): string {
  const spec = canonicalPackageSpecifier(hostId);
  return `Install the package (e.g. npm i -D ${spec}) so it can resolve via canonical fallback, or declare a custom package under object-map targets: { ${hostId}: "<specifier>" }.`;
}

/**
 * Enrich selection / registration failures with package install guidance.
 * Pass `cwd` so missing-detect can mention host markers when the canonical package is absent.
 */
export function enrichUnregisteredTargetMessage(message: string, cwd?: string): string {
  if (ALREADY_GUIDED.test(message)) return message;

  const unregisteredId = extractUnregisteredId(message);
  if (unregisteredId) {
    if (isCanonicalHostId(unregisteredId)) {
      return `${message}. ${installHintFor(unregisteredId)}`;
    }
    return (
      `${message}. For a custom host, install its integration package and declare it under ` +
      `object-map targets: (e.g. targets: { ${unregisteredId}: "<package-or-path>" }), ` +
      `then pass --target <id> or set active.`
    );
  }

  if (
    cwd &&
    /Target detection is missing or ambiguous|Target detection is unavailable/i.test(message)
  ) {
    const markers = probeCanonicalHostMarkers(cwd);
    if (markers.length === 1) {
      const id = markers[0]!;
      return (
        `${message}. Detected host marker(s) for "${id}", but ${canonicalPackageSpecifier(id)} ` +
        `is not installed or resolvable. ${installHintFor(id)}`
      );
    }
    if (markers.length > 1) {
      const list = markers.map((id) => `${id} (${canonicalPackageSpecifier(id)})`).join(", ");
      return (
        `${message}. Multiple host markers found (${list}). Install the matching integration ` +
        `package(s), then pass --target <id> or set active.`
      );
    }
  }

  return message;
}
