/**
 * Opt-in experimental gate for registry resolve/install and publish.
 * Enable with `BAPM_EXPERIMENTAL_REGISTRIES=1` or `{ experimentalRegistries: true }`.
 */
import { RegistryError } from "./errors.ts";

export const EXPERIMENTAL_REGISTRIES_ENV = "BAPM_EXPERIMENTAL_REGISTRIES";

export function isExperimentalRegistriesEnabled(options?: {
  experimentalRegistries?: boolean;
  env?: NodeJS.ProcessEnv;
}): boolean {
  if (options?.experimentalRegistries === true) return true;
  const env = options?.env ?? process.env;
  const v = env[EXPERIMENTAL_REGISTRIES_ENV];
  return v === "1" || v === "true" || v === "yes";
}

export function experimentalRegistriesRemediation(): string {
  return `Set ${EXPERIMENTAL_REGISTRIES_ENV}=1 to enable experimental registry resolve/install and publish`;
}

export function assertExperimentalRegistriesEnabled(options?: {
  experimentalRegistries?: boolean;
  env?: NodeJS.ProcessEnv;
  action?: string;
}): void {
  if (isExperimentalRegistriesEnabled(options)) return;
  const action = options?.action ?? "registry operations";
  throw new RegistryError(
    "REGISTRY_GATE",
    `${action} require the experimental registries gate. ${experimentalRegistriesRemediation()}`,
  );
}
