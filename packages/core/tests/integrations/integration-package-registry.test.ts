import { describe, expect, test } from "vite-plus/test";

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
  createIntegrationRegistry(): Registry;
};

type CursorIntegration = {
  createCursorIntegration(): { id: string };
};

describe("published integration package behavior", () => {
  test("exposes integration API and Cursor runtime entry points", async () => {
    const api = (await import("@b-apm/integration-api")) as IntegrationApi;
    const cursor = (await import("@b-apm/integration-cursor")) as CursorIntegration;

    expect(typeof api.createIntegrationRegistry).toBe("function");
    expect(cursor.createCursorIntegration().id).toBe("cursor");
  });

  test("injects a host-neutral registered integration through the generic registry", async () => {
    const api = (await import("@b-apm/integration-api")) as IntegrationApi;
    const registry = api.createIntegrationRegistry();
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
});
