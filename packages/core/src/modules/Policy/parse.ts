import type { PolicyWarning } from "./errors.ts";
import { PolicyError } from "./errors.ts";
import type {
  ParsePolicyResult,
  PolicyDependencies,
  PolicyDocument,
  PolicyEnforcement,
} from "./types.ts";

const KNOWN_TOP_LEVEL = new Set([
  "name",
  "enforcement",
  "fetch_failure",
  "dependencies",
  "extends",
  "mcp",
  "manifest",
  "unmanaged_files",
  "security",
  "version",
]);

const ENFORCEMENT_VALUES = new Set(["off", "warn", "block"]);

/**
 * Validate a pre-parsed JS value as an OpenAPM-shaped policy document.
 * Retains unknown top-level (with warnings) and `x-*` (silent) keys.
 */
export function parsePolicyDocument(input: unknown): ParsePolicyResult {
  const warnings: PolicyWarning[] = [];

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new PolicyError(
      "POLICY_VALIDATION",
      "Policy must contain a YAML object/mapping at the document root",
    );
  }

  const raw = input as Record<string, unknown>;

  if (!("name" in raw) || typeof raw.name !== "string" || raw.name.length === 0) {
    throw new PolicyError("POLICY_VALIDATION", 'Policy requires a non-empty string "name"', {
      path: "name",
    });
  }

  const enforcement = coerceEnforcement(raw.enforcement, "enforcement", true);
  const fetch_failure = coerceEnforcement(raw.fetch_failure, "fetch_failure", false);

  for (const key of Object.keys(raw)) {
    if (KNOWN_TOP_LEVEL.has(key)) continue;
    if (key.startsWith("x-")) continue;
    warnings.push({
      code: "PL_009_UNKNOWN_KEY",
      message: `Unknown top-level policy key "${key}" (non-blocking)`,
      path: key,
    });
  }

  const document: PolicyDocument = {
    ...raw,
    name: raw.name,
    enforcement,
    fetch_failure,
  };

  if ("dependencies" in raw && raw.dependencies !== undefined && raw.dependencies !== null) {
    document.dependencies = parseDependencies(raw.dependencies);
  }

  return { document, policy: document, warnings };
}

/** Back-compat / acceptance entry for already-loaded JS objects. */
export function parsePolicy(input: unknown): ParsePolicyResult {
  return parsePolicyDocument(input);
}

function coerceEnforcement(
  value: unknown,
  field: string,
  allowDefault: boolean,
): PolicyEnforcement {
  if (value === undefined || value === null) {
    if (allowDefault) return "warn";
    return "warn";
  }
  // YAML unquoted `off` → boolean false (APM coerce to "off")
  if (value === false) return "off";
  if (value === true) {
    throw new PolicyError(
      "POLICY_VALIDATION",
      `Policy "${field}" boolean true is invalid; use off|warn|block`,
      { path: field },
    );
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (ENFORCEMENT_VALUES.has(normalized)) {
      return normalized as PolicyEnforcement;
    }
    throw new PolicyError(
      "POLICY_VALIDATION",
      `Policy "${field}" has invalid enforcement value "${value}" (expected off|warn|block)`,
      { path: field, details: { value } },
    );
  }
  throw new PolicyError(
    "POLICY_VALIDATION",
    `Policy "${field}" must be off|warn|block (got ${typeof value})`,
    { path: field },
  );
}

function parseDependencies(value: unknown): PolicyDependencies {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new PolicyError("POLICY_VALIDATION", 'Policy "dependencies" must be a mapping/object', {
      path: "dependencies",
    });
  }

  const raw = value as Record<string, unknown>;
  const deps: PolicyDependencies = {};

  if ("allow" in raw) {
    deps.allow = parseTriStateList(raw.allow, "dependencies.allow");
  }
  if ("deny" in raw) {
    deps.deny = parseTriStateList(raw.deny, "dependencies.deny");
  }
  if ("require" in raw) {
    deps.require = parseTriStateList(raw.require, "dependencies.require");
  }
  if ("max_depth" in raw && raw.max_depth !== undefined && raw.max_depth !== null) {
    const n = Number(raw.max_depth);
    if (!Number.isFinite(n) || n < 0) {
      throw new PolicyError(
        "POLICY_VALIDATION",
        'Policy "dependencies.max_depth" must be a non-negative number',
        { path: "dependencies.max_depth" },
      );
    }
    deps.max_depth = Math.floor(n);
  }
  if ("require_pinned_constraint" in raw && raw.require_pinned_constraint !== undefined) {
    deps.require_pinned_constraint = Boolean(raw.require_pinned_constraint);
  }

  return deps;
}

/** pl-005: omit not represented; null → unset (null); [] → []; list → list. */
function parseTriStateList(value: unknown, path: string): string[] | null {
  if (value === null) return null;
  if (!Array.isArray(value)) {
    throw new PolicyError("POLICY_VALIDATION", `Policy "${path}" must be a list or null`, {
      path,
    });
  }
  const out: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item !== "string") {
      throw new PolicyError("POLICY_VALIDATION", `Policy "${path}[${i}]" must be a string`, {
        path: `${path}[${i}]`,
      });
    }
    out.push(item);
  }
  return out;
}
