import type { PolicyCliPorts } from "@/common/policyFetcher.ts";

export type LockOptions = {
  args?: string[];
  cwd?: string;
  updateRefs?: boolean;
  verbose?: boolean;
  parallelDownloads?: number;
  /** Injected policy ports (tests); production defaults to a curl fetcher. */
  policyPorts?: PolicyCliPorts;
};

export type LockResult = {
  ok: boolean;
  exitCode: number;
  message?: string;
  lockPath?: string;
};

export type LockExportSbomResult =
  | { ok: true; json: string; format: string }
  | { ok: false; error: string };

export type LockDeps = {
  resolveAndLock: (
    options: {
      cwd?: string;
      updateRefs?: boolean;
      parallelDownloads?: number;
      verbose?: boolean;
      policyPath?: string;
      policy?: string;
      noPolicy?: boolean;
      noRepoPolicy?: boolean;
    } & PolicyCliPorts,
  ) => Promise<{ lockPath: string }>;
  exportSbom?: (options: {
    cwd?: string;
    format?: string;
    timestamp?: string;
  }) => Promise<LockExportSbomResult>;
};
