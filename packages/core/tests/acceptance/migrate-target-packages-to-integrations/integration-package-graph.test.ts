import { createRequire } from "node:module";
import { describe, expect, test } from "vite-plus/test";

const requireFromAcceptance = createRequire(import.meta.url);

type Registry = {
  register(integration: {
    id: string;
    deployRoots: string[];
    detect: (context: { cwd: string }) => boolean | Promise<boolean>;
    materialize: () => Promise<{ deployedFiles: [] }>;
  }): void;
  get(id: string): unknown;
  list(): Array<{ id: string }>;
  detect(cwd: string): Promise<{ detectedIds: string[]; diagnostics: unknown[] }>;
};

type IntegrationApi = {
  createTargetRegistry(): Registry;
};

type CursorIntegration = {
  createCursorTarget(): { id: string };
};

function requirePackageManifest(packageSpecifier: string): {
  name: string;
  dependencies?: Record<string, string>;
} {
  return requireFromAcceptance(`${packageSpecifier}/package.json`) as {
    name: string;
    dependencies?: Record<string, string>;
  };
}

describe("integration package migration", () => {
  test("exposes renamed integration packages and their public identities", async () => {
    const api = (await import("bapm-integration-api")) as IntegrationApi;
    const cursor = (await import("bapm-integration-cursor")) as CursorIntegration;

    expect(requirePackageManifest("bapm-integration-api").name).toBe("bapm-integration-api");
    expect(requirePackageManifest("bapm-integration-cursor").name).toBe(
      "bapm-integration-cursor",
    );
    expect(typeof api.createTargetRegistry).toBe("function");
    expect(cursor.createCursorTarget().id).toBe("cursor");
  });

  test("injects a host-neutral registered integration through the generic registry", async () => {
    const api = (await import("bapm-integration-api")) as IntegrationApi;
    const registry = api.createTargetRegistry();
    const integration = {
      id: "example-host",
      deployRoots: [".example"],
      detect: ({ cwd }: { cwd: string }) => cwd === "/project",
      materialize: async () => ({ deployedFiles: [] as [] }),
    };

    registry.register(integration);

    expect(registry.get("example-host")).toMatchObject({ id: "example-host" });
    expect(registry.list()).toEqual([expect.objectContaining({ id: "example-host" })]);
    await expect(registry.detect("/project")).resolves.toEqual({
      detectedIds: ["example-host"],
      diagnostics: [],
    });
  });

  test("publishes only the integration-api boundary to core and Cursor", () => {
    const core = requirePackageManifest("@bapm/core");
    const cursor = requirePackageManifest("bapm-integration-cursor");

    expect(core.dependencies).toMatchObject({
      "bapm-integration-api": "workspace:*",
    });
    expect(core.dependencies).not.toHaveProperty("bapm-integration-cursor");
    expect(cursor.dependencies).toEqual({
      "bapm-integration-api": "workspace:*",
    });
  });

  test.each(["bapm-target-api", "bapm-target-cursor"])(
    "rejects retired package specifier %s without an alias",
    async (legacySpecifier) => {
      await expect(import(legacySpecifier)).rejects.toThrow();
      expect(() => requireFromAcceptance.resolve(legacySpecifier)).toThrow();
    },
  );
});
