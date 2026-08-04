/**
 * Pack — plain-zip producer archive, sc-007 secret refuse, pr-004 release gate.
 *
 * ## Public API
 *
 * - `runPack` / `packProject` / `packArchive` — create plain zip
 * - `extractPackArchive` / `unpackArchive` / `extractPack` — extract for install round-trip
 * - `checkReleaseTag` / `checkRelease` / `runCheckRelease` — pr-004 tag↔version gate
 * - `isSecretPackPath` — sc-007 matcher
 * - Types / `PackError`
 *
 * ## Example
 *
 * ```ts
 * import { runPack, checkReleaseTag, extractPackArchive } from "@/modules/Pack";
 * await runPack({ cwd: ".", archive: true });
 * ```
 *
 * ## Release signing (pr-005)
 *
 * Producers SHOULD sign release tags (GPG/SSH/sigstore). M7 check may warn when
 * unsigned but MUST NOT fail solely for lack of signature.
 */
export type {
  RunPackOptions,
  RunPackResult,
  ExtractPackArchiveOptions,
  ExtractPackArchiveResult,
  CheckReleaseTagOptions,
  CheckReleaseTagResult,
} from "./types.ts";

export type { PackErrorCode } from "./errors.ts";
export { PackError } from "./errors.ts";

export { runPack, packProject, packArchive } from "./runPack.ts";
export { extractPackArchive, unpackArchive, extractPack } from "./extract.ts";
export { checkReleaseTag, checkRelease, runCheckRelease } from "./checkRelease.ts";
export { isSecretPackPath, describeSecretRefuse } from "./secrets.ts";
