export type LockOptions = {
  args?: string[];
  cwd?: string;
  updateRefs?: boolean;
  verbose?: boolean;
  parallelDownloads?: number;
};

export type LockResult = {
  ok: boolean;
  exitCode: number;
  message?: string;
  lockPath?: string;
};

export type LockDeps = {
  resolveAndLock: (options: {
    cwd?: string;
    updateRefs?: boolean;
    parallelDownloads?: number;
    verbose?: boolean;
    policyPath?: string;
    policy?: string;
    noPolicy?: boolean;
  }) => Promise<{ lockPath: string }>;
};
