/** Normalized `dependencies.mcp` declaration used by collect + inventory. */
export type ParsedMcpDeclaration = {
  name: string;
  transport?: string;
  type?: string;
  command?: string;
  args?: unknown[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  registry?: unknown;
  /** Original YAML object, retained for read-only inspection output. */
  raw: Record<string, unknown>;
};

/**
 * Parse the loose `dependencies.mcp` list. Entries without a non-empty `name`
 * are ignored; unknown keys are kept on `raw` for inspection.
 */
export function parseMcpDeclarations(raw: unknown): ParsedMcpDeclaration[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedMcpDeclaration[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (!name) continue;
    out.push({
      name,
      transport: typeof rec.transport === "string" ? rec.transport : undefined,
      type: typeof rec.type === "string" ? rec.type : undefined,
      command: typeof rec.command === "string" ? rec.command : undefined,
      args: Array.isArray(rec.args) ? rec.args : undefined,
      url: typeof rec.url === "string" ? rec.url : undefined,
      env:
        rec.env && typeof rec.env === "object" && !Array.isArray(rec.env)
          ? (rec.env as Record<string, string>)
          : undefined,
      headers:
        rec.headers && typeof rec.headers === "object" && !Array.isArray(rec.headers)
          ? (rec.headers as Record<string, string>)
          : undefined,
      registry: rec.registry,
      raw: { ...rec },
    });
  }
  return out;
}
