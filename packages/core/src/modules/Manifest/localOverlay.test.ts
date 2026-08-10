/**
 * Unit: local overlay merge / allowlist (manifest-local-overlay).
 */
import { describe, expect, test } from "vite-plus/test";
import { mergeLocalOverlay, parseLocalOverlayDocument, parseManifest } from "./index.ts";

describe("local overlay merge helpers", () => {
  test("active replace; targets and env deep-merge; registries by name", () => {
    const base = parseManifest({
      name: "u",
      version: "1.0.0",
      active: ["cursor"],
      targets: { cursor: "@b-apm/integration-cursor" },
      env: { FOO: "base", BAR: "keep" },
      registries: {
        keep: { url: "https://keep.example/r" },
        overwrite: { url: "https://old.example/r" },
      },
      dependencies: { apm: [], mcp: [] },
    });

    const overlay = parseLocalOverlayDocument({
      active: ["x-acme-editor"],
      targets: { "x-acme-editor": "@scope/acme" },
      env: { FOO: "local" },
      registries: {
        overwrite: { url: "https://new.example/r" },
        added: { url: "https://added.example/r" },
      },
    });

    const doc = mergeLocalOverlay(base, overlay);
    expect(doc.active).toEqual(["x-acme-editor"]);
    expect(doc.targets).toMatchObject({
      cursor: "@b-apm/integration-cursor",
      "x-acme-editor": "@scope/acme",
    });
    expect(doc.env).toMatchObject({ FOO: "local", BAR: "keep" });
    expect(doc.registries?.keep).toBeTruthy();
    expect(doc.registries?.added).toBeTruthy();
    const overwrite = doc.registries?.overwrite;
    const url =
      typeof overwrite === "string"
        ? overwrite
        : overwrite && typeof overwrite === "object"
          ? String(overwrite.url ?? "")
          : "";
    expect(url).toMatch(/new\.example/);
  });

  test("forbidden overlay key rejected", () => {
    expect(() => parseLocalOverlayDocument({ name: "hijack", active: ["cursor"] })).toThrow(
      /name|not allowed|allowlist/i,
    );
  });
});
