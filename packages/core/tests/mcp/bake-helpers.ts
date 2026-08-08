/**
 * Helpers for public-API MCP env/headers bake tests.
 */
import { asText } from "../asText.ts";
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

/**
 * Public bake-time resolver for MCP env/headers string maps.
 */
export function getBakeMcpStringMap(): (
  map: Record<string, string>,
  options?: {
    overrides?: Record<string, string>;
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  },
) => unknown {
  return pickExport(
    [
      "bakeMcpStringMap",
      "bakeMcpEnvMap",
      "resolveMcpEnvPlaceholders",
      "bakeMcpPlaceholders",
      "bakeMcpEnv",
    ],
    "MCP env/headers bake",
  ) as (
    map: Record<string, string>,
    options?: {
      overrides?: Record<string, string>;
      env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
    },
  ) => unknown;
}

function asBakeSuccess(result: unknown): Record<string, string> {
  if (result && typeof result === "object" && "ok" in result) {
    const r = result as { ok: unknown; value?: unknown; env?: unknown; map?: unknown };
    if (!r.ok) {
      const message = asText(
        (r as { message?: unknown; error?: unknown }).message ??
          (r as { error?: unknown }).error ??
          "bake failed",
      );
      throw Object.assign(new Error(message), { bakeResult: result });
    }
    const value = r.value ?? r.env ?? r.map;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, string>;
    }
    throw new TypeError("bake succeeded without a string map value");
  }
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as Record<string, string>;
  }
  throw new TypeError(`bake returned unexpected value: ${asText(result)}`);
}

/** Invoke bake; unwrap Result-style returns; rethrow failures. */
export function bakeMap(
  map: Record<string, string>,
  options?: {
    overrides?: Record<string, string>;
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  },
): Record<string, string> {
  return asBakeSuccess(getBakeMcpStringMap()(map, options));
}

/** Expect bake to fail; return the diagnostic message text. */
export function expectBakeFailure(
  map: Record<string, string>,
  options?: {
    overrides?: Record<string, string>;
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  },
): string {
  // Surface missing public export as setup failure (not a soft bake diagnostic).
  getBakeMcpStringMap();
  try {
    const value = bakeMap(map, options);
    throw new Error(`expected bake to fail, got ${JSON.stringify(value)}`);
  } catch (error) {
    if (error instanceof TypeError && /expected @bapm\/core to export/i.test(error.message)) {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith("expected bake to fail")) {
      throw error;
    }
    if (error && typeof error === "object" && "bakeResult" in error) {
      const r = (error as { bakeResult: unknown }).bakeResult;
      return JSON.stringify(r);
    }
    return error instanceof Error ? error.message : asText(error);
  }
}
