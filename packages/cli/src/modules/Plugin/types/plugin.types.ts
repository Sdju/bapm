export interface PluginDeps {
  name: string;
  manifestFile: string;
  validatePluginName: (name: string) => { ok: boolean; message?: string } | boolean;
  validateProjectName: (name: string) => { ok: boolean; message?: string } | boolean;
  createMinimalManifest: (options: {
    name: string;
    version?: string;
    target?: string;
    targets?: string[];
    description?: string;
    author?: string;
    pluginMode?: boolean;
  }) => Record<string, unknown>;
  writeProducerManifest: (
    document: Record<string, unknown>,
    options: { cwd?: string; path?: string },
  ) => { path: string };
  writePluginJson: (options: {
    cwd?: string;
    path?: string;
    name: string;
    version?: string;
    description?: string;
    author?: { name: string };
    license?: string;
  }) => string;
  existsSync: (path: string) => boolean;
  mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
}

export interface PluginOptions {
  args: string[];
  cwd?: string;
}

export interface PluginResult {
  ok: boolean;
  message?: string;
  path?: string;
}
