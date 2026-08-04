/**
 * Core p2-lk-018 helpers — pickExport for TDD RED APIs.
 */
import * as core from "@bapm/core";

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

export function getIsCiEnvTruthy(): (env: Record<string, string | undefined>) => boolean {
  return pickExport(
    ["isCiEnvTruthy", "isCiTruthy", "isOpenApmCiTruthy"],
    "p2-lk-018 CI truthiness",
  ) as (env: Record<string, string | undefined>) => boolean;
}

export function getResolveEffectiveFrozen(): (options: {
  frozen?: boolean;
  noFrozen?: boolean;
  env?: Record<string, string | undefined>;
}) => boolean {
  return pickExport(
    ["resolveEffectiveFrozen", "resolveFrozenMode", "effectiveFrozen"],
    "p2-lk-018 effective frozen",
  ) as (options: {
    frozen?: boolean;
    noFrozen?: boolean;
    env?: Record<string, string | undefined>;
  }) => boolean;
}
