import type { Downloader, GitRemote, TagLister } from "@/modules/Resolver";
import type { TargetRegistry } from "bapm-target-api";

export type RunInstallOptions = {
  cwd?: string;
  frozen?: boolean;
  /** Rejected when combined with frozen. */
  update?: boolean;
  updateRefs?: boolean;
  /** Injected target registry (from bapm-target-api). */
  targetRegistry?: TargetRegistry;
  /** Alias accepted by acceptance helpers. */
  registry?: TargetRegistry;
  /** Override active target ids (else from manifest / detection). */
  activeTargets?: string[];
  parallelDownloads?: number;
  maxDepth?: number;
  verbose?: boolean;
  gitRemote?: GitRemote;
  tagLister?: TagLister;
  downloader?: Downloader;
};

/** Alias for design naming flexibility. */
export type InstallOptions = RunInstallOptions;

export type InstallResult = {
  ok: true;
  lockPath?: string;
  modulesDir: string;
  activeTargets: string[];
  primitivesCount: number;
  diagnostics: unknown[];
};

export type EnforceFrozenOptions = {
  cwd?: string;
  updateRefs?: boolean;
  update?: boolean;
};
