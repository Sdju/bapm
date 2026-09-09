/**
 * CLI helpers for install-trust-bin acceptance.
 */
import {
  createTempProject,
  expectKnownCommand,
  expectKnownFlags,
  fingerprintProject,
  formatInstallHelp,
  parseInstallArgs,
  runInProject,
  writeLeafProject,
  type TempProject,
} from "../../install/helpers.ts";

export {
  createTempProject,
  expectKnownCommand,
  expectKnownFlags,
  fingerprintProject,
  formatInstallHelp,
  parseInstallArgs,
  runInProject,
  writeLeafProject,
  type TempProject,
};

export type TrustBinMode = "allow" | "deny" | "default";

export function trustBinOf(parsed: Record<string, unknown>): TrustBinMode | undefined {
  const raw = parsed.trustBin ?? parsed.trust_bin ?? parsed.binTrust;
  if (raw === "allow" || raw === "deny" || raw === "default") return raw;
  if (parsed.trustBin === true || parsed.trustBinAllow === true) return "allow";
  if (parsed.noTrustBin === true || parsed.trustBinDeny === true) return "deny";
  return undefined;
}
