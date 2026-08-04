import type {
  AttributedPrimitive,
  PrimitiveConflictDiagnostic,
  ResolvePrimitiveConflictsOptions,
  ResolvePrimitiveConflictsResult,
} from "./types.ts";

/**
 * Resolve name+type conflicts: local wins over deps (pr-002);
 * among deps, first-declared wins (pr-003).
 */
export function resolvePrimitiveConflicts(
  options: ResolvePrimitiveConflictsOptions,
): ResolvePrimitiveConflictsResult {
  const declarationOrder = options.declarationOrder ?? [];
  const orderIndex = new Map(declarationOrder.map((n, i) => [n, i]));
  const diagnostics: PrimitiveConflictDiagnostic[] = [];

  const groups = new Map<string, AttributedPrimitive[]>();
  for (const p of options.primitives) {
    const key = `${p.type}::${p.name}`;
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  const winners: AttributedPrimitive[] = [];

  for (const [, group] of groups) {
    if (group.length === 1) {
      winners.push(group[0]!);
      continue;
    }

    const locals = group.filter((p) => p.source === "local");
    const deps = group.filter((p) => p.source !== "local");

    if (locals.length > 0) {
      const winner = locals[0]!;
      winners.push(winner);
      for (const loser of [...locals.slice(1), ...deps]) {
        diagnostics.push({
          code: "PR_002_LOCAL_OVERRIDE",
          message: `Local primitive "${winner.name}" (${winner.type}) overrides ${loser.source}`,
          name: winner.name,
          type: String(winner.type),
          winnerSource: winner.source,
          loserSource: loser.source,
        });
      }
      continue;
    }

    // Among deps: first-declared wins
    const sorted = [...deps].sort((a, b) => {
      const an = packageNameOf(a);
      const bn = packageNameOf(b);
      const ai = orderIndex.has(an) ? orderIndex.get(an)! : Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.has(bn) ? orderIndex.get(bn)! : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      // Stable fallback: keep discovery order
      return 0;
    });
    const winner = sorted[0]!;
    winners.push(winner);
    for (const loser of sorted.slice(1)) {
      diagnostics.push({
        code: "PR_003_FIRST_DECLARED",
        message: `Dependency primitive "${winner.name}" from ${winner.source} wins over ${loser.source}`,
        name: winner.name,
        type: String(winner.type),
        winnerSource: winner.source,
        loserSource: loser.source,
      });
    }
  }

  return { primitives: winners, diagnostics };
}

/** Alias for callers that prefer a shorter name. */
export const resolveConflicts = resolvePrimitiveConflicts;

function packageNameOf(p: AttributedPrimitive): string {
  if (p.packageName) return p.packageName;
  if (p.source.startsWith("dependency:")) return p.source.slice("dependency:".length);
  return "";
}
