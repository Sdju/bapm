/**
 * Registry — HTTP client, experimental gate, publish archive, self-update check,
 * resolve/materialize helpers (lk-013 / rs-009).
 *
 * ## Public API
 *
 * - `createRegistryClient` — list / download / publish
 * - `buildPublishArchive` — flat zip with `apm.yml` + `.apm/`
 * - `checkSelfUpdate` — npm dist-tag comparison
 * - Gate: `isExperimentalRegistriesEnabled`, `assertExperimentalRegistriesEnabled`
 * - Resolve helpers: `resolveRegistryBaseUrl`, `materializeRegistryArchive`, …
 */
export type {
  BuildPublishArchiveOptions,
  BuildPublishArchiveResult,
  CheckSelfUpdateOptions,
  CheckSelfUpdateResult,
  CreateRegistryClientOptions,
  RegistryClient,
  RegistryHttpRequest,
  RegistryHttpResponse,
  RegistryHttpTransport,
  RegistryVersionInfo,
} from "./types.ts";

export type { RegistryErrorCode } from "./errors.ts";
export { RegistryError } from "./errors.ts";

export {
  EXPERIMENTAL_REGISTRIES_ENV,
  isExperimentalRegistriesEnabled,
  experimentalRegistriesRemediation,
  assertExperimentalRegistriesEnabled,
} from "./gate.ts";

import {
  createRegistryClient,
  sha256Digest,
  sha256Hex,
  digestsEqual,
  verifyArchiveDigest,
} from "./createClient.ts";

export { createRegistryClient, sha256Digest, sha256Hex, digestsEqual, verifyArchiveDigest };

/** Aliases accepted by acceptance helpers. */
export const createRegistryHttpClient = createRegistryClient;
export const createPackageRegistryClient = createRegistryClient;

export { createFetchTransport, resolveRegistryToken, joinRegistryUrl } from "./transport.ts";

import { buildPublishArchive } from "./publishArchive.ts";
export { buildPublishArchive };
export const createPublishArchive = buildPublishArchive;
export const packPublishArchive = buildPublishArchive;
export const buildRegistryPublishZip = buildPublishArchive;

import { checkSelfUpdate } from "./selfUpdate.ts";
export { checkSelfUpdate };
export const compareSelfUpdate = checkSelfUpdate;
export const runSelfUpdateCheck = checkSelfUpdate;
export const fetchLatestCliVersion = checkSelfUpdate;

export {
  resolveRegistryBaseUrl,
  parsePackageId,
  registryRepoUrl,
  downloadUrl,
  pickRegistryVersion,
  materializeRegistryArchive,
  fetchAndMaterializeRegistry,
  rewriteDownloadBase,
  modulesRegistryDest,
} from "./resolveHelpers.ts";

export type {
  ResolvedRegistryCoords,
  MaterializeRegistryPackageOptions,
} from "./resolveHelpers.ts";
