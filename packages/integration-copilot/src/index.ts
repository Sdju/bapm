/**
 * @b-apm/integration-copilot — GitHub Copilot runtime integration and
 * marketplace pack mapper for bapm.
 */

export {
  createCopilotIntegration,
  createCopilotIntegration as createIntegration,
  toCamelCaseEvent,
} from "./createCopilotIntegration.ts";

import type { MarketplaceOutputIntegration } from "@b-apm/integration-api";

type PackageEntry = Record<string, unknown>;
type ResolvedPackage = Record<string, unknown> & { entry: PackageEntry };

const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/i;

/** Normalize marketplace identity to kebab-case (Copilot App requirement). */
export function sanitizeCopilotMarketplaceName(name: string): string {
  const result = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return result || "marketplace";
}

function isDisplayVersion(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !/[\^~><=* ]/.test(value);
}

function remoteUrlFor(pkg: ResolvedPackage): string | undefined {
  if (typeof pkg.sourceUrl === "string" && pkg.sourceUrl) return pkg.sourceUrl;
  if (typeof pkg.host === "string" && pkg.host && typeof pkg.sourceRepo === "string") {
    return `https://${pkg.host}/${pkg.sourceRepo}`;
  }
  return undefined;
}

function copilotSource(pkg: ResolvedPackage, name: string): string | Record<string, unknown> {
  if (pkg.isLocal) return String(pkg.source);

  const remoteUrl = remoteUrlFor(pkg);
  const source: Record<string, unknown> = remoteUrl
    ? { source: "url", url: remoteUrl }
    : { source: "github", repo: String(pkg.sourceRepo) };

  if (typeof pkg.subdir === "string" && pkg.subdir) source.path = pkg.subdir;

  const ref = typeof pkg.ref === "string" && pkg.ref ? pkg.ref : undefined;
  let sha = typeof pkg.sha === "string" && pkg.sha ? pkg.sha : undefined;

  if (sha && !FULL_COMMIT_SHA.test(sha)) {
    throw new TypeError(
      `Copilot package '${name}' requires a full 40-character commit SHA. ` +
        "Use a full commit pin or a resolvable branch/tag ref and repack.",
    );
  }

  if (ref && FULL_COMMIT_SHA.test(ref)) {
    if (sha && sha.toLowerCase() !== ref.toLowerCase()) {
      throw new TypeError(
        `Copilot package '${name}' has conflicting commit pins. Correct its ref and repack.`,
      );
    }
    sha = ref;
  } else if (ref) {
    source.ref = ref;
  }

  if (sha) source.sha = sha;
  return source;
}

/** Maps resolved packages into the Copilot marketplace document. */
export function mapCopilotMarketplace(
  config: unknown,
  resolved: unknown[],
): Record<string, unknown> {
  const cfg = config as Record<string, unknown>;
  const owner = cfg.owner;
  const doc: Record<string, unknown> = {
    name: sanitizeCopilotMarketplaceName(
      typeof cfg.name === "string" && cfg.name ? cfg.name : "marketplace",
    ),
  };

  if (owner) {
    if (typeof owner === "string") {
      doc.owner = { name: owner };
    } else {
      const value = owner as { name: string; email?: string };
      doc.owner = {
        name: value.name,
        ...(value.email ? { email: value.email } : {}),
      };
    }
  } else {
    doc.owner = { name: "unknown" };
  }

  const metadata: Record<string, unknown> = {};
  if (typeof cfg.description === "string" && cfg.description) {
    metadata.description = cfg.description;
  }
  if (typeof cfg.version === "string" && cfg.version) metadata.version = cfg.version;
  if (Object.keys(metadata).length > 0) doc.metadata = metadata;

  doc.plugins = (resolved as ResolvedPackage[]).map((pkg) => {
    const entry = pkg.entry ?? {};
    const plugin: Record<string, unknown> = { name: pkg.name };
    if (typeof entry.description === "string" && entry.description) {
      plugin.description = entry.description;
    }
    if (typeof entry.version === "string" && (pkg.isLocal || isDisplayVersion(entry.version))) {
      plugin.version = entry.version;
    }
    plugin.source = copilotSource(pkg, String(pkg.name));
    return plugin;
  });

  return doc;
}

export const copilotMarketplaceIntegration: MarketplaceOutputIntegration = {
  id: "copilot",
  marketplaceOutput: {
    format: "copilot",
    defaultOutput: ".github/plugin/marketplace.json",
    map: mapCopilotMarketplace,
  },
};
