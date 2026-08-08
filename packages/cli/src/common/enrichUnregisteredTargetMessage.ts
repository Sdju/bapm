/**
 * Append actionable install + object-map guidance to unknown-target diagnostics.
 */
export function enrichUnregisteredTargetMessage(message: string): string {
  if (!/unknown or unregistered target/i.test(message)) return message;
  if (/targets:|object-map|@bapm\/integration|install.*integration/i.test(message)) {
    return message;
  }
  return (
    `${message}. Install the host integration package and declare it under ` +
    `object-map targets: (e.g. targets: { <id>: "@bapm/integration-<id>" }), ` +
    `then pass --target <id> or set active.`
  );
}
