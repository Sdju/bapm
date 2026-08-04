export type LifecycleCliDeps = {
  name: string;
  manifestFile: string;
  lockFile: string;
};

export type LifecycleResult = {
  ok: boolean;
  exitCode?: number;
  message?: string;
};
