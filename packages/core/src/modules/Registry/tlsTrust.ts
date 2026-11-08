/**
 * Additive corporate CA support for registry HTTPS.
 *
 * `NODE_EXTRA_CA_CERTS` is handled by Node/undici at startup. `BAPM_EXTRA_CA_BUNDLE`
 * is read at runtime, validated, and appended to Node's default trust store without
 * replacing it. Disable with `BAPM_DISABLE_EXTRA_CA_BUNDLE=1`.
 */
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import * as tls from "node:tls";
import { RegistryError } from "./errors.ts";

export const EXTRA_CA_BUNDLE_ENV = "BAPM_EXTRA_CA_BUNDLE";
export const DISABLE_EXTRA_CA_BUNDLE_ENV = "BAPM_DISABLE_EXTRA_CA_BUNDLE";

const CERT_BLOCK_RE = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;

type TlsModuleLike = {
  getCACertificates?: (type?: "default" | "system") => string[];
  setDefaultCACertificates?: (certificates: string[]) => void;
};

export type ApplyExtraCaBundleOptions = {
  /** Environment source; defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Injectable reader for tests. */
  readFile?: (path: string) => string;
  /** Injectable `node:tls` surface for tests. */
  tlsModule?: TlsModuleLike;
};

export type ExtraCaBundleResult = {
  applied: boolean;
  path?: string;
  added?: number;
  reason?: "unset" | "disabled";
};

function isEnabled(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== "" && normalized !== "0" && normalized !== "false" && normalized !== "no";
}

/**
 * Extract and validate every PEM certificate in *pem*. Fails closed when the
 * bundle contains no certificate or any malformed certificate.
 */
export function parseExtraCaBundlePem(pem: string, path = EXTRA_CA_BUNDLE_ENV): string[] {
  const certificates = pem.match(CERT_BLOCK_RE) ?? [];
  if (certificates.length === 0) {
    throw new RegistryError(
      "REGISTRY_TLS",
      `${EXTRA_CA_BUNDLE_ENV} (${path}) does not contain a PEM certificate ` +
        `(expected "-----BEGIN CERTIFICATE-----" blocks). ` +
        `Fix the file or unset ${EXTRA_CA_BUNDLE_ENV}; to disable it for one run set ` +
        `${DISABLE_EXTRA_CA_BUNDLE_ENV}=1.`,
      { details: { path } },
    );
  }

  for (let i = 0; i < certificates.length; i += 1) {
    try {
      // Parses and validates the DER payload inside the PEM envelope.
      new X509Certificate(certificates[i]);
    } catch (cause) {
      throw new RegistryError(
        "REGISTRY_TLS",
        `${EXTRA_CA_BUNDLE_ENV} (${path}) contains an invalid PEM certificate at block ${i + 1}. ` +
          `Fix the bundle or unset ${EXTRA_CA_BUNDLE_ENV}; to disable it for one run set ` +
          `${DISABLE_EXTRA_CA_BUNDLE_ENV}=1.`,
        { cause, details: { path, block: i + 1 } },
      );
    }
  }

  return certificates;
}

/**
 * Append `BAPM_EXTRA_CA_BUNDLE` certificates to Node's default CA list.
 * Never replaces the system/default trust store.
 */
export function applyExtraCaBundle(options: ApplyExtraCaBundleOptions = {}): ExtraCaBundleResult {
  const env = options.env ?? process.env;

  if (isEnabled(env[DISABLE_EXTRA_CA_BUNDLE_ENV])) {
    return { applied: false, reason: "disabled" };
  }

  const path = env[EXTRA_CA_BUNDLE_ENV]?.trim();
  if (!path) {
    return { applied: false, reason: "unset" };
  }

  const reader = options.readFile ?? ((file: string) => readFileSync(file, "utf8"));
  let pem: string;
  try {
    pem = reader(path);
  } catch (cause) {
    throw new RegistryError(
      "REGISTRY_TLS",
      `${EXTRA_CA_BUNDLE_ENV} points to an unreadable file: ${path}. ` +
        `Fix the path or unset ${EXTRA_CA_BUNDLE_ENV}; to disable it for one run set ` +
        `${DISABLE_EXTRA_CA_BUNDLE_ENV}=1. ` +
        `Alternatively export NODE_EXTRA_CA_CERTS=/path/to/ca.pem before starting bapm.`,
      { cause, details: { path } },
    );
  }

  const certificates = parseExtraCaBundlePem(pem, path);
  const tlsModule = options.tlsModule ?? tls;

  if (
    typeof tlsModule.getCACertificates !== "function" ||
    typeof tlsModule.setDefaultCACertificates !== "function"
  ) {
    throw new RegistryError(
      "REGISTRY_TLS",
      `${EXTRA_CA_BUNDLE_ENV} requires Node's tls.getCACertificates / ` +
        `tls.setDefaultCACertificates (Node >=22.15). ` +
        `Use NODE_EXTRA_CA_CERTS=/path/to/ca.pem before starting bapm, or upgrade Node.`,
      { details: { path } },
    );
  }

  let defaults: string[];
  try {
    defaults = tlsModule.getCACertificates("default");
  } catch (cause) {
    throw new RegistryError(
      "REGISTRY_TLS",
      `Failed to read Node's default CA certificates before applying ${EXTRA_CA_BUNDLE_ENV}: ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
      { cause, details: { path } },
    );
  }

  const combined = [...new Set([...defaults, ...certificates])];
  try {
    tlsModule.setDefaultCACertificates(combined);
  } catch (cause) {
    throw new RegistryError(
      "REGISTRY_TLS",
      `Failed to apply ${EXTRA_CA_BUNDLE_ENV} (${path}) to Node's default CA store: ` +
        `${cause instanceof Error ? cause.message : String(cause)}. ` +
        `Use NODE_EXTRA_CA_CERTS=/path/to/ca.pem before starting bapm instead.`,
      { cause, details: { path } },
    );
  }

  return { applied: true, path, added: certificates.length };
}

export const applyExtraCaBundleFromEnv = applyExtraCaBundle;
