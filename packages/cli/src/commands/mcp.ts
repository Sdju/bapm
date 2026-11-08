import type { McpApi } from "@/modules/Mcp";

export async function mcpCommand(argv: string[], mcp: McpApi): Promise<number> {
  const result = await mcp.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
