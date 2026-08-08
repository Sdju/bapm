export interface InitDeps {
  name: string;
  manifestFile: string;
  createMinimalManifest: (options: {
    name: string;
    version?: string;
    target?: string;
    targets?: string[] | Record<string, string>;
    active?: string[];
  }) => Record<string, unknown>;
  writeProducerManifest: (
    document: Record<string, unknown>,
    options: { cwd?: string; path?: string },
  ) => { path: string };
  existsSync: (path: string) => boolean;
  detectCursor: (cwd: string) => boolean;
}

export interface InitOptions {
  args: string[];
  cwd?: string;
}

export interface InitResult {
  ok: boolean;
  message?: string;
  path?: string;
}
