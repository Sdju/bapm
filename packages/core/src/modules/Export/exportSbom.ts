/**
 * Read-only SBOM export from a lockfile document or project cwd.
 */

import { loadLockfileOrNull } from "@/modules/Lockfile";
import { formatUnsupportedMessage, normalizeFormat, serializeSbom } from "./serialize.ts";
import {
  FIXED_EPOCH_TIMESTAMP,
  type ExportSbomOptions,
  type ExportSbomResult,
  type LockfileDocument,
  type LockfileInput,
} from "./types.ts";

function resolveTimestamp(
  explicit: string | undefined,
  lockGeneratedAt: string | undefined,
): string {
  if (explicit) return explicit;
  const epoch = process.env.SOURCE_DATE_EPOCH;
  if (epoch) {
    const n = Number(epoch);
    if (Number.isFinite(n)) {
      return new Date(n * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
    }
  }
  if (lockGeneratedAt) return lockGeneratedAt;
  return FIXED_EPOCH_TIMESTAMP;
}

function loadDocument(
  options: ExportSbomOptions,
): { ok: true; document: LockfileDocument | LockfileInput } | { ok: false; error: string } {
  if (options.document) {
    return { ok: true, document: options.document };
  }
  const loaded = loadLockfileOrNull({ cwd: options.cwd });
  if (!loaded) {
    return {
      ok: false,
      error: "No lockfile found. Run 'bapm lock' to generate one first.",
    };
  }
  return { ok: true, document: loaded.document };
}

/**
 * Export an SBOM inventory from lock fields only (no resolve / network / mutation).
 */
export async function exportSbom(options: ExportSbomOptions = {}): Promise<ExportSbomResult> {
  const format = normalizeFormat(options.format);
  if (!format) {
    return {
      ok: false,
      error: formatUnsupportedMessage(String(options.format ?? "")),
    };
  }

  const loaded = loadDocument(options);
  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
  }

  const generatedAt =
    typeof (loaded.document as Record<string, unknown>).generated_at === "string"
      ? String((loaded.document as Record<string, unknown>).generated_at)
      : undefined;
  const timestamp = resolveTimestamp(options.timestamp, generatedAt);
  const json = serializeSbom(loaded.document, format, timestamp);
  return { ok: true, json, format };
}
