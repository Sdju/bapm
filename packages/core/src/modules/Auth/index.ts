/**
 * Auth — shared OpenAPM §10.3 credential host-class, resolve, redirect Auth drop,
 * and ambient-suppress git child env.
 *
 * Public API only — callers import `@/modules/Auth` (or package root exports).
 */

export type {
  ProviderHostClass,
  RegistryAliasEntry,
  RegistryAliasMap,
  ResolvedCredentials,
  ResolveCredentialsOptions,
  SameCredentialHostClassOptions,
  BuildGitChildEnvOptions,
  FetchWithRedirectAuthDropInit,
} from "./types.ts";

export {
  credentialHostClassOf,
  credentialHostClass,
  authHostClassOf,
  hostClassForCredentials,
  credentialHostClassForHost,
  sameCredentialHostClass,
  credentialHostClassesEqual,
  hostsShareCredentialClass,
  buildAliasCredentialClassMap,
  hostnameFromAlias,
  normalizeHostname,
  hostnameFromUrlOrHost,
} from "./credentialHostClass.ts";

export {
  selectProviderClassForHost,
  effectiveProviderClassForHost,
  classifyProviderHostClass,
  classifyMarketplaceHost,
  collectGitlabHosts,
  collectAdoHosts,
} from "./selectProviderClass.ts";

export {
  resolveCredentialsForHost,
  resolveAuthCredentialsForHost,
  resolveHostCredentials,
  authHeadersForResolved,
} from "./resolveCredentials.ts";

export {
  fetchWithRedirectAuthDrop,
  fetchRedirectAuthDrop,
  redirectSafeFetch,
  fetchWithCredentialHostClassRedirects,
} from "./fetchRedirectAuthDrop.ts";

export {
  buildGitChildEnv,
  buildHardenedGitEnv,
  createGitChildEnv,
  gitChildEnvForHost,
  mayAttachGitCredential,
  PLATFORM_TOKEN_ENV_NAMES,
} from "./gitChildEnv.ts";
