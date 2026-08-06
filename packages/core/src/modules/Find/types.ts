/** Offline find / reverse-index types. */

export const WORKSPACE_OWNER_KEY = "." as const;

/** path → ordered owner keys (dependency packageKey or workspace `.`). */
export type ReverseIndex = Map<string, string[]>;

export type FindPathOptions = {
  cwd?: string;
  /** Query path (alias: `query`). */
  path?: string;
  query?: string;
  /** Append origin (`--source`). */
  source?: boolean;
  showSource?: boolean;
  /** Print why-chains (`--path`). */
  why?: boolean;
  showPath?: boolean;
  pathDetail?: boolean;
};

export type FindPathResult = {
  ok: boolean;
  exitCode: number;
  text: string;
  stderr: string;
  owners?: string[];
};
