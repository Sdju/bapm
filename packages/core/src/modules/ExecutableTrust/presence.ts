import type {
  EvaluateRequiredPackagePresenceOptions,
  EvaluateRequiredPackagePresenceResult,
  RequiredPackagePresenceDiagnostic,
} from "./types.ts";

/**
 * Evaluate `dependencies.require` from lockfile presence (sc-012).
 * Present + MCP withheld → presence OK + distinct `EXEC_TRUST_WITHHELD`.
 * Missing from lock → `POLICY_REQUIRE`.
 */
export function evaluateRequiredPackagePresence(
  options: EvaluateRequiredPackagePresenceOptions = {},
): EvaluateRequiredPackagePresenceResult {
  const require = Array.isArray(options.require) ? options.require : [];
  const lockIds = new Set(
    (Array.isArray(options.lockPackageIds) ? options.lockPackageIds : []).map(String),
  );
  const trustByPackage = options.trustByPackage ?? {};

  const diagnostics: RequiredPackagePresenceDiagnostic[] = [];

  for (const identity of require) {
    const id = String(identity);
    if (!lockIds.has(id)) {
      diagnostics.push({
        code: "POLICY_REQUIRE",
        message: `required package "${id}" is missing from the lockfile`,
        identity: id,
      });
      continue;
    }

    const trust = trustByPackage[id];
    if (!trust) continue;
    const outcome = String(trust.outcome ?? "");
    const withheld =
      trust.withhold === true ||
      outcome === "withhold" ||
      outcome === "deny" ||
      trust.allowed === false;

    if (withheld && outcome !== "allow" && outcome !== "skip") {
      diagnostics.push({
        code: "EXEC_TRUST_WITHHELD",
        message: `required package "${id}" is present in the lockfile but MCP/executables were withheld`,
        identity: id,
      });
    }
  }

  const missing = diagnostics.some((d) => d.code === "POLICY_REQUIRE");
  const ok = !missing;
  return {
    ok,
    satisfied: ok,
    diagnostics,
    violations: diagnostics.filter((d) => d.code === "POLICY_REQUIRE"),
    codes: diagnostics.map((d) => d.code),
  };
}

/** Alias preferred by acceptance helpers. */
export const classifyRequiredPackagePresence = evaluateRequiredPackagePresence;
export const evaluateRequireLockPresence = evaluateRequiredPackagePresence;
export const evaluateRequiredPackagesFromLock = evaluateRequiredPackagePresence;
