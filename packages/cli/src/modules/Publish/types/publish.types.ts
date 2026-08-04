export type PublishOptions = {
  args?: string[];
  cwd: string;
};

export type PublishResult = {
  ok: boolean;
  message?: string;
};

export type PublishDeps = {
  name: string;
  buildPublishArchive: (options: {
    cwd: string;
    dryRun?: boolean;
  }) =>
    | { bytes: Uint8Array; owner: string; repo: string; version: string; name: string }
    | Promise<{ bytes: Uint8Array; owner: string; repo: string; version: string; name: string }>;
  createRegistryClient: (options: { baseUrl: string; token?: string; registryName?: string }) => {
    publish: (owner: string, repo: string, version: string, bytes: Uint8Array) => Promise<unknown>;
  };
  assertExperimentalRegistriesEnabled: (options?: { action?: string }) => void;
  loadManifest: (options: { cwd: string }) => {
    document: {
      name: string;
      version: string;
      registries?: Record<string, { url: string; [key: string]: unknown } | string>;
    };
  };
  resolveRegistryBaseUrl: (args: {
    registries?: Record<string, { url: string; [key: string]: unknown } | string>;
    registryName?: string;
    registryBaseUrl?: string;
  }) => { baseUrl: string; registryName?: string };
};
