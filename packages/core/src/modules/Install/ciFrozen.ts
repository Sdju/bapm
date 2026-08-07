/**
 * OpenAPM req-lk-018: CI truthiness and effective frozen resolution.
 *
 * Truthy CI: variable present and not "", "0", or "false" (case-insensitive).
 * Only the `CI` key is consulted — vendor vars (GITHUB_ACTIONS, …) do not imply CI.
 */

export type ResolveEffectiveFrozenOptions = {
  /** Explicit `--frozen` / force-on. */
  frozen?: boolean;
  /** Explicit `--no-frozen` opt-out. */
  noFrozen?: boolean;
  /** Env map (defaults to empty — callers pass `process.env` or a test stub). */
  env?: Record<string, string | undefined>;
};

/**
 * OpenAPM CI truthiness: `CI` present and not `""` / `"0"` / `"false"` (case-insensitive).
 */
export function isCiEnvTruthy(env: Record<string, string | undefined> = {}): boolean {
  const raw = env.CI;
  if (raw === undefined) return false;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === "" || normalized === "0" || normalized === "false") return false;
  return true;
}

/**
 * Resolve effective frozen mode from flags + env.
 *
 * Precedence: `--frozen`+`--no-frozen` conflict → throw;
 * else `--no-frozen` → false;
 * else `--frozen` OR truthy CI → true;
 * else false.
 */
export function resolveEffectiveFrozen(options: ResolveEffectiveFrozenOptions = {}): boolean {
  const frozen = options.frozen === true;
  const noFrozen = options.noFrozen === true;
  if (frozen && noFrozen) {
    throw new Error("Cannot combine --frozen and --no-frozen (mutually exclusive flags conflict)");
  }
  if (noFrozen) return false;
  if (frozen) return true;
  return isCiEnvTruthy(options.env ?? {});
}
