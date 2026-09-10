import type { AttributedPrimitive } from "@/modules/Primitives";

/**
 * Omit whole-plugin (portable) primitives for packages admitted to Copilot native
 * registration so Copilot does not double-deploy loose skills/MCP.
 */
export function filterPrimitivesForCopilotNative(
  primitives: AttributedPrimitive[],
  admittedPackageNames: ReadonlySet<string>,
): AttributedPrimitive[] {
  if (admittedPackageNames.size === 0) return primitives;
  return primitives.filter((p) => {
    const packageName = String(p.packageName ?? "");
    if (!packageName || !admittedPackageNames.has(packageName)) return true;
    const format = String((p as { format?: unknown }).format ?? "");
    if (format === "agent-plugin") return false;
    // Defensive: treat skill/mcp from admitted roots as covered by native registration.
    const type = String(p.type ?? "").toLowerCase();
    if (type === "skill" || type === "mcp") return false;
    return true;
  });
}
