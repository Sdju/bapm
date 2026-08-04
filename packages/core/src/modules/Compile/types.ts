export type CompileAgentsMdOptions = {
  cwd?: string;
  /** When true, discover/validate only — do not write AGENTS.md. */
  validate?: boolean;
  /** Output filename (default AGENTS.md). */
  outputFile?: string;
  modulesDir?: string;
};

export type CompileAgentsMdResult = {
  ok: boolean;
  path?: string;
  content: string;
  wrote: boolean;
  primitivesCount: number;
};
