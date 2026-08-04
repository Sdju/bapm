import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { loadManifest } from "@/modules/Manifest";
import { PackError } from "./errors.ts";
import type { CheckReleaseTagOptions, CheckReleaseTagResult } from "./types.ts";

/** Semver 2.0.0 with optional leading `v` (OpenAPM git-semver / pr-004). */
const TAG_SEMVER_RE =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * pr-004: compare release tag (optional leading `v`) to manifest `version`.
 * Never creates or pushes tags. pr-005 unsigned is advisory only.
 */
export async function checkReleaseTag(
  options: CheckReleaseTagOptions = {},
): Promise<CheckReleaseTagResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const { document } = loadManifest({ cwd });
  const version = document.version;

  const warnings: string[] = [];
  let tag = options.tag?.trim();

  if (!tag) {
    tag = resolveHeadReleaseTag(cwd);
    if (!tag) {
      throw new PackError(
        "RELEASE_TAG_MISSING",
        "Release tag required: pass --tag or ensure HEAD has a resolvable release tag",
        { details: { cwd } },
      );
    }
  }

  if (!TAG_SEMVER_RE.test(tag)) {
    throw new PackError(
      "RELEASE_TAG_INVALID",
      `Invalid release tag shape "${tag}": must match semver with optional leading v (pr-004 regex)`,
      { details: { tag, version } },
    );
  }

  const normalizedTag = tag.startsWith("v") ? tag.slice(1) : tag;
  if (normalizedTag !== version) {
    throw new PackError(
      "RELEASE_TAG_MISMATCH",
      `Release tag "${tag}" does not match manifest version "${version}" (pr-004 mismatch)`,
      { details: { tag, version } },
    );
  }

  // pr-005: unsigned advisory only — never fail solely for unsigned in M7.
  const treatUnsigned =
    options.unsigned === true ||
    options.requireSignature === false ||
    options.requireSignature === undefined;
  if (treatUnsigned && options.unsigned === true) {
    warnings.push(
      `Release tag "${tag}" is unsigned (pr-005 advisory): producers SHOULD sign release tags`,
    );
  } else if (options.requireSignature === true) {
    // Detectability is best-effort; never hard-fail M7 for unsigned.
    const signed = detectTagSigned(cwd, tag);
    if (!signed) {
      warnings.push(
        `Release tag "${tag}" appears unsigned (pr-005 advisory): producers SHOULD sign release tags`,
      );
    }
  }

  return {
    ok: true,
    exitCode: 0,
    tag,
    version,
    warnings,
  };
}

/** Aliases for acceptance helpers. */
export const checkRelease = checkReleaseTag;
export const runCheckRelease = checkReleaseTag;

function resolveHeadReleaseTag(cwd: string): string | undefined {
  try {
    const out = execFileSync("git", ["tag", "--points-at", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    if (!out) return undefined;
    const tags = out
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length === 0) return undefined;
    if (tags.length === 1) return tags[0];

    // Prefer a tag that matches manifest version when multiple point at HEAD.
    try {
      const { document } = loadManifest({ cwd });
      const version = document.version;
      const exact = tags.find((t) => t === version || t === `v${version}`);
      if (exact) return exact;
    } catch {
      /* ignore */
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function detectTagSigned(cwd: string, tag: string): boolean {
  try {
    // Annotated / signed tags show object type "tag"; verify-tag exits 0 when signed.
    execFileSync("git", ["tag", "-v", tag], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}
