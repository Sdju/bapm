export type RunAuditCiOptions = {
  cwd?: string;
  ci?: boolean;
};

export type AuditCiResult = {
  ok: boolean;
  exitCode: number;
  violations: string[];
  diagnostics: string[];
  text: string;
};
