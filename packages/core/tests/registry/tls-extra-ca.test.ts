/**
 * P1 parity: additive corporate CA support for registry HTTPS.
 */
import { describe, expect, test } from "vite-plus/test";
import { rootCertificates } from "node:tls";
import {
  applyExtraCaBundle,
  applyExtraCaBundleFromEnv,
  createFetchTransport,
  DISABLE_EXTRA_CA_BUNDLE_ENV,
  EXTRA_CA_BUNDLE_ENV,
  parseExtraCaBundlePem,
} from "@b-apm/core";

function catchError(fn: () => unknown): { code?: string; message?: string } {
  try {
    fn();
  } catch (error) {
    return error as { code?: string; message?: string };
  }
  throw new Error("expected throw");
}

const validPem = rootCertificates[0]!;

describe("BAPM_EXTRA_CA_BUNDLE", () => {
  test("invalid PEM fails closed with REGISTRY_TLS", () => {
    const err = catchError(() =>
      applyExtraCaBundle({
        env: { [EXTRA_CA_BUNDLE_ENV]: "/etc/bapm/ca.pem" },
        readFile: () => "this is not a certificate",
        tlsModule: {
          getCACertificates: () => ["default"],
          setDefaultCACertificates: () => {},
        },
      }),
    );
    expect(err.code).toBe("REGISTRY_TLS");
    expect(err.message).toMatch(/BAPM_EXTRA_CA_BUNDLE/);
    expect(err.message).toMatch(/PEM/i);
    expect(err.message).toMatch(/BAPM_DISABLE_EXTRA_CA_BUNDLE=1/);
  });

  test("malformed certificate block fails closed", () => {
    const malformed = "-----BEGIN CERTIFICATE-----\nnot-base64-der\n-----END CERTIFICATE-----\n";
    const err = catchError(() => parseExtraCaBundlePem(malformed, "/ca.pem"));
    expect(err.code).toBe("REGISTRY_TLS");
    expect(err.message).toMatch(/invalid PEM certificate/);
  });

  test("disable switch skips the bundle even when the file is unreadable", () => {
    const result = applyExtraCaBundleFromEnv({
      env: {
        [EXTRA_CA_BUNDLE_ENV]: "/does/not/exist.pem",
        [DISABLE_EXTRA_CA_BUNDLE_ENV]: "1",
      },
      readFile: () => {
        throw new Error("must not be read");
      },
    });
    expect(result).toEqual({ applied: false, reason: "disabled" });
  });

  test("appends to default CAs instead of replacing the trust store", () => {
    let applied: string[] | undefined;
    const result = applyExtraCaBundle({
      env: { [EXTRA_CA_BUNDLE_ENV]: "/etc/bapm/ca.pem" },
      readFile: () => validPem,
      tlsModule: {
        getCACertificates: () => ["default-a", "default-b"],
        setDefaultCACertificates: (certs) => {
          applied = certs;
        },
      },
    });

    expect(result).toEqual({ applied: true, path: "/etc/bapm/ca.pem", added: 1 });
    expect(applied?.slice(0, 2)).toEqual(["default-a", "default-b"]);
    expect(applied?.[2]).toBe(validPem);
  });

  test("unreadable bundle fails closed with a NODE_EXTRA_CA_CERTS hint", () => {
    const err = catchError(() =>
      applyExtraCaBundle({
        env: { [EXTRA_CA_BUNDLE_ENV]: "/missing/ca.pem" },
        readFile: () => {
          throw new Error("ENOENT");
        },
        tlsModule: {
          getCACertificates: () => ["default"],
          setDefaultCACertificates: () => {},
        },
      }),
    );
    expect(err.code).toBe("REGISTRY_TLS");
    expect(err.message).toMatch(/NODE_EXTRA_CA_CERTS/);
    expect(err.message).toMatch(/\/missing\/ca\.pem/);
  });

  test("TLS network error names NODE_EXTRA_CA_CERTS and BAPM_EXTRA_CA_BUNDLE", async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      const cause = new Error("self-signed certificate in certificate chain");
      (cause as Error & { code?: string }).code = "SELF_SIGNED_CERT_IN_CHAIN";
      throw cause;
    }) as typeof fetch;

    try {
      let thrown: unknown;
      try {
        await createFetchTransport().fetch({
          method: "GET",
          url: "https://registry.internal.example/v1/packages/a/b/versions",
        });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeTruthy();
      const err = thrown as { code?: string; message?: string };
      expect(err.code).toBe("REGISTRY_HTTP");
      expect(err.message).toMatch(/NODE_EXTRA_CA_CERTS/);
      expect(err.message).toMatch(/BAPM_EXTRA_CA_BUNDLE/);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});
