/**
 * Escape hatch: skip discovery + checks (not a discovery provider).
 * Primary: BAPM_POLICY_DISABLE=1; also honor APM_POLICY_DISABLE=1.
 */
export function isPolicyDisabled(options?: { noPolicy?: boolean }): boolean {
  if (options?.noPolicy === true) return true;
  if (process.env.BAPM_POLICY_DISABLE === "1") return true;
  if (process.env.APM_POLICY_DISABLE === "1") return true;
  return false;
}
