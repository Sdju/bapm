import type { AuditApi } from "@/modules/Audit";

export async function auditCommand(argv: string[], audit: AuditApi): Promise<number> {
  const result = await audit.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
