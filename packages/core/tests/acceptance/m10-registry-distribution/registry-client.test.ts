/**
 * M10 MUST: Registry HTTP client against mock registry (APM de-facto /v1 wire).
 * Specs: registry-http-client. Checklist C §1,5 (auth), wire list/download/PUT.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  buildFlatPackageZip,
  clientDownload,
  clientListVersions,
  clientPublish,
  getCreateRegistryClient,
  sha256Digest,
  startMockRegistry,
  type MockRegistry,
} from "./helpers.ts";

describe("M10 registry HTTP client (mock HTTP)", () => {
  let registry: MockRegistry | undefined;

  afterEach(async () => {
    await registry?.close();
    registry = undefined;
  });

  test("list versions returns version + digest from mock registry", async () => {
    const bytes = buildFlatPackageZip({ name: "contoso/demo", version: "1.0.0" });
    const digest = sha256Digest(bytes);
    registry = await startMockRegistry({
      packages: [
        {
          owner: "contoso",
          repo: "demo",
          versions: [{ version: "1.0.0", bytes, digest }],
        },
      ],
    });

    const create = getCreateRegistryClient();
    const client = create({
      baseUrl: registry.baseUrl,
      url: registry.baseUrl,
      registryUrl: registry.baseUrl,
    });

    const listed = await clientListVersions(client, "contoso", "demo");
    const text = JSON.stringify(listed);
    expect(text).toMatch(/1\.0\.0/);
    expect(text).toMatch(new RegExp(digest.replace(":", "\\:")));
  });

  test("download returns archive bytes for known version", async () => {
    const bytes = buildFlatPackageZip({ name: "contoso/demo", version: "1.2.0" });
    registry = await startMockRegistry({
      packages: [
        {
          owner: "contoso",
          repo: "demo",
          versions: [{ version: "1.2.0", bytes }],
        },
      ],
    });

    const client = getCreateRegistryClient()({
      baseUrl: registry.baseUrl,
      url: registry.baseUrl,
    });
    const downloaded = await clientDownload(client, "contoso", "demo", "1.2.0");
    expect(downloaded.byteLength).toBe(bytes.byteLength);
    expect(Buffer.from(downloaded).equals(Buffer.from(bytes))).toBe(true);
  });

  test("PUT uploads zip and succeeds on 2xx", async () => {
    const bytes = buildFlatPackageZip({ name: "contoso/demo", version: "2.0.0" });
    registry = await startMockRegistry({ putStatus: 201 });

    const prev = process.env.BAPM_REGISTRY_TOKEN;
    process.env.BAPM_REGISTRY_TOKEN = "test-token";
    try {
      const client = getCreateRegistryClient()({
        baseUrl: registry.baseUrl,
        url: registry.baseUrl,
        token: "test-token",
      });
      await clientPublish(client, "contoso", "demo", "2.0.0", bytes);
      expect(registry.puts.length).toBe(1);
      expect(registry.puts[0]!.url).toMatch(/\/v1\/packages\/contoso\/demo\/versions\/2\.0\.0/);
      expect(registry.puts[0]!.body.byteLength).toBe(bytes.byteLength);
    } finally {
      if (prev === undefined) delete process.env.BAPM_REGISTRY_TOKEN;
      else process.env.BAPM_REGISTRY_TOKEN = prev;
    }
  });

  test("PUT 409 surfaces immutability / bump version", async () => {
    const bytes = buildFlatPackageZip({ version: "1.0.0" });
    registry = await startMockRegistry({ putStatus: 409 });

    const client = getCreateRegistryClient()({
      baseUrl: registry.baseUrl,
      url: registry.baseUrl,
    });

    let thrown: unknown;
    try {
      await clientPublish(client, "contoso", "demo", "1.0.0", bytes);
    } catch (e) {
      thrown = e;
    }
    expect(thrown, "expected publish 409 to fail").toBeTruthy();
    const haystack =
      thrown instanceof Error
        ? `${thrown.message}\n${(thrown as { code?: string }).code ?? ""}`
        : String(thrown);
    expect(haystack).toMatch(/409|immutab|already|bump|conflict/i);
  });

  test("anonymous list does not send Authorization when token unset", async () => {
    const bytes = buildFlatPackageZip();
    registry = await startMockRegistry({
      packages: [{ owner: "contoso", repo: "demo", versions: [{ version: "1.0.0", bytes }] }],
      requireAuth: false,
    });

    const prev = process.env.BAPM_REGISTRY_TOKEN;
    delete process.env.BAPM_REGISTRY_TOKEN;
    try {
      const client = getCreateRegistryClient()({
        baseUrl: registry.baseUrl,
        url: registry.baseUrl,
      });
      await clientListVersions(client, "contoso", "demo");
      const listReq = registry.requests.find((r) => r.method === "GET" && /\/versions\/?$/.test(r.url));
      expect(listReq).toBeTruthy();
      expect(listReq!.authorization).toBeUndefined();
    } finally {
      if (prev !== undefined) process.env.BAPM_REGISTRY_TOKEN = prev;
    }
  });

  test("401 diagnostic names BAPM_REGISTRY_TOKEN remediation", async () => {
    const bytes = buildFlatPackageZip();
    registry = await startMockRegistry({
      packages: [{ owner: "contoso", repo: "demo", versions: [{ version: "1.0.0", bytes }] }],
      requireAuth: true,
      token: "secret",
    });

    const prev = process.env.BAPM_REGISTRY_TOKEN;
    delete process.env.BAPM_REGISTRY_TOKEN;
    try {
      const client = getCreateRegistryClient()({
        baseUrl: registry.baseUrl,
        url: registry.baseUrl,
      });
      let thrown: unknown;
      try {
        await clientListVersions(client, "contoso", "demo");
      } catch (e) {
        thrown = e;
      }
      expect(thrown, "expected 401 fail closed").toBeTruthy();
      const haystack =
        thrown instanceof Error
          ? `${thrown.message}\n${(thrown as { code?: string }).code ?? ""}`
          : String(thrown);
      expect(haystack).toMatch(/BAPM_REGISTRY_TOKEN|token/i);
      expect(haystack).toMatch(/401|403|unauthor|auth|forbidden/i);
    } finally {
      if (prev !== undefined) process.env.BAPM_REGISTRY_TOKEN = prev;
    }
  });
});
