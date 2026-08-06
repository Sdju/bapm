import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { loadYamlDocument } from "@/common/yaml/loadDocument.ts";
import { MarketplaceAuthoringError } from "./errors.ts";
import { loadMarketplaceFromLegacyYml } from "./load.ts";
import type { MigrateMarketplaceYmlOptions, MigrateMarketplaceYmlResult } from "./types.ts";

/**
 * Fold legacy marketplace.yml into bapm.yml `marketplace:` block.
 */
export function migrateMarketplaceYml(
  options: MigrateMarketplaceYmlOptions = {},
): MigrateMarketplaceYmlResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const dryRun = Boolean(options.dryRun);
  const force = Boolean(options.force || options.yes);
  const legacyPath = resolve(cwd, "marketplace.yml");
  const bapmPath = resolve(cwd, "bapm.yml");

  try {
    if (!existsSync(legacyPath)) {
      throw new MarketplaceAuthoringError("marketplace.yml not found — nothing to migrate.", 1);
    }
    if (!existsSync(bapmPath)) {
      throw new MarketplaceAuthoringError(
        "bapm.yml not found. Run 'bapm marketplace init' or create a project manifest first.",
        1,
      );
    }

    // Validate legacy before mutating.
    loadMarketplaceFromLegacyYml({ cwd, path: legacyPath });

    const legacyRaw = loadYamlDocument(readFileSync(legacyPath, "utf8"), legacyPath);
    if (!legacyRaw || typeof legacyRaw !== "object" || Array.isArray(legacyRaw)) {
      throw new MarketplaceAuthoringError("marketplace.yml root must be a mapping", 2);
    }
    const legacy = legacyRaw as Record<string, unknown>;

    const bapmRaw = loadYamlDocument(readFileSync(bapmPath, "utf8"), bapmPath);
    if (!bapmRaw || typeof bapmRaw !== "object" || Array.isArray(bapmRaw)) {
      throw new MarketplaceAuthoringError("bapm.yml root must be a mapping", 2);
    }
    const bapm = bapmRaw as Record<string, unknown>;

    if (bapm.marketplace !== undefined && bapm.marketplace !== null && !force) {
      throw new MarketplaceAuthoringError(
        "bapm.yml already has a 'marketplace:' block. Pass --force / -y to overwrite.",
        2,
      );
    }

    const block: Record<string, unknown> = {};
    for (const key of ["name", "description", "version"] as const) {
      if (legacy[key] !== undefined && legacy[key] !== null && legacy[key] !== bapm[key]) {
        block[key] = legacy[key];
      }
    }
    for (const key of [
      "owner",
      "sourceBase",
      "output",
      "outputs",
      "claude",
      "codex",
      "metadata",
      "build",
      "packages",
      "versioning",
    ] as const) {
      if (legacy[key] !== undefined && legacy[key] !== null) {
        block[key] = legacy[key];
      }
    }

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        message: "Dry-run: would fold marketplace.yml into bapm.yml marketplace: block (no write).",
      };
    }

    bapm.marketplace = block;
    const next = stringify(bapm, {
      lineWidth: 0,
      defaultStringType: "PLAIN",
      defaultKeyType: "PLAIN",
    });
    const tmp = `${bapmPath}.${process.pid}.migrate.tmp`;
    writeFileSync(tmp, next, "utf8");
    renameSync(tmp, bapmPath);

    try {
      unlinkSync(legacyPath);
    } catch {
      /* leave legacy if delete fails */
    }

    return {
      ok: true,
      dryRun: false,
      message: "Migrated marketplace.yml into bapm.yml marketplace: block.",
    };
  } catch (err) {
    return {
      ok: false,
      dryRun,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const migrateLegacyMarketplaceYml = migrateMarketplaceYml;
export const runMarketplaceMigrate = migrateMarketplaceYml;
