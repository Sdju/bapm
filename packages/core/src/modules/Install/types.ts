import type { Downloader, GitRemote, TagLister } from "@/modules/Resolver";
import type { TargetRegistry } from "bapm-target-api";

export type RunInstallOptions = {
  cwd?: string;
  frozen?: boolean;
  /** Rejected when combined with frozen. */
  update?: boolean;
  updateRefs?: boolean;
  /**
   * Force activation of a registered target id even when `detect` is false
   * (e.g. CLI `--target cursor`). Alias: `forceTarget`.
   */
  forcedTarget?: string;
  /** Alias for `forcedTarget`. */
  forceTarget?: string;
  /** Injected target registry (from bapm-target-api). */
  targetRegistry?: TargetRegistry;
  /** Alias accepted by acceptance helpers. */
  registry?: TargetRegistry;
  /** Override active target ids (else from manifest / detection / forced). */
  activeTargets?: string[];
  parallelDownloads?: number;
  maxDepth?: number;
  verbose?: boolean;
  gitRemote?: GitRemote;
  tagLister?: TagLister;
  downloader?: Downloader;
  /**
   * Local pack zip path — extract into project root before install orchestration
   * (M7 install-from-archive round-trip).
   */
  archivePath?: string;
  /** Explicit policy file path (`--policy`). */
  policyPath?: string;
  /** Alias for `policyPath`. */
  policy?: string;
  /** Skip policy discovery + checks (`--no-policy` / env disable). */
  noPolicy?: boolean;
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
  /** Policy gate warnings / findings (M8). */
  policyDiagnostics?: unknown[];
};

export type EnforceFrozenOptions = {
  cwd?: string;
  updateRefs?: boolean;
  update?: boolean;
};
