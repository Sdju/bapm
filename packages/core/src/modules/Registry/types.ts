export type RegistryHttpRequest = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: Uint8Array | Buffer;
};

export type RegistryHttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
};

/** Injectable HTTP transport for registry client (mock-friendly). */
export type RegistryHttpTransport = {
  fetch(request: RegistryHttpRequest): Promise<RegistryHttpResponse>;
};

export type CreateRegistryClientOptions = {
  /** Registry base URL (aliases accepted by acceptance helpers). */
  baseUrl?: string;
  url?: string;
  registryUrl?: string;
  /** Bearer token; falls back to env when unset. */
  token?: string;
  /** Named registry key for `BAPM_REGISTRY_<NAME>_TOKEN`. */
  registryName?: string;
  /** Injectable transport (defaults to real fetch). */
  transport?: RegistryHttpTransport;
  /** JSON body hard cap for list responses (~10 MiB). */
  maxJsonBytes?: number;
};

export type RegistryVersionInfo = {
  version: string;
  digest: string;
  published_at?: string;
};

export type RegistryClient = {
  baseUrl: string;
  listVersions(owner: string, repo: string): Promise<RegistryVersionInfo[]>;
  download(owner: string, repo: string, version: string): Promise<Uint8Array>;
  publish(owner: string, repo: string, version: string, bytes: Uint8Array): Promise<void>;
};

export type BuildPublishArchiveOptions = {
  cwd?: string;
  /** When true, still build bytes but callers skip PUT. */
  dryRun?: boolean;
  /** Optional docs to include at zip root. */
  includeDocs?: boolean;
};

export type BuildPublishArchiveResult = {
  bytes: Uint8Array;
  owner: string;
  repo: string;
  version: string;
  name: string;
};

export type CheckSelfUpdateOptions = {
  currentVersion?: string;
  /** npm registry base (or mock). Env: BAPM_SELF_UPDATE_METADATA_URL / BAPM_NPM_REGISTRY. */
  registryUrl?: string;
  packageName?: string;
  /** dist-tag; default `latest`. */
  distTag?: string;
  /** Injectable metadata fetch. */
  fetchMetadata?: (url: string) => Promise<unknown>;
};

export type CheckSelfUpdateResult = {
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  unknownVersion: boolean;
  message: string;
};
