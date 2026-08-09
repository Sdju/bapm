/**
 * Hosts migrate to shared helpers without expanding strip-only cleanup
 * (integration-api-hook-helpers acceptance).
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { hostSrc } from "./helpers.ts";

const STRIP_ONLY = [
  ["integration-cursor", "createCursorIntegration.ts"],
  ["integration-claude", "createClaudeIntegration.ts"],
  ["integration-gemini", "createGeminiIntegration.ts"],
  ["integration-codex", "createCodexIntegration.ts"],
] as const;

const REMOVE_HOSTS = [
  ["integration-windsurf", "createWindsurfIntegration.ts"],
  ["integration-copilot", "createCopilotIntegration.ts"],
  ["integration-kiro", "createKiroIntegration.ts"],
  ["integration-antigravity", "createAntigravityIntegration.ts"],
] as const;

const SIMPLE_COPY_HOSTS = [
  ...STRIP_ONLY,
  ["integration-windsurf", "createWindsurfIntegration.ts"],
  ["integration-copilot", "createCopilotIntegration.ts"],
] as const;

function src(pkg: string, file: string): string {
  return readFileSync(hostSrc(pkg, file), "utf8");
}

describe("host migration to shared hook helpers", () => {
  test("merge/copy hosts import shared sidecar + strip + simple copyHookScript", () => {
    for (const [pkg, file] of SIMPLE_COPY_HOSTS) {
      const body = src(pkg, file);
      expect(body, pkg).toMatch(/readHookOwnershipSidecar/);
      expect(body, pkg).toMatch(/writeHookOwnershipSidecar/);
      expect(body, pkg).toMatch(/\bcopyHookScript\b/);
      expect(body, `${pkg} still defines local copyHookScript`).not.toMatch(
        /function copyHookScript\s*\(/,
      );
      expect(body, `${pkg} still defines local readOwnershipSidecar`).not.toMatch(
        /function readOwnershipSidecar\s*\(/,
      );
    }
    for (const [pkg, file] of STRIP_ONLY) {
      const body = src(pkg, file);
      expect(body, pkg).toMatch(/stripOwnedHookCommands/);
      expect(body, `${pkg} still defines local stripOwnedEntries`).not.toMatch(
        /function stripOwnedEntries\s*\(/,
      );
    }
    const windsurf = src("integration-windsurf", "createWindsurfIntegration.ts");
    expect(windsurf).toMatch(/stripOwnedHookCommands/);
    expect(windsurf).toMatch(/removeOwnedHookArtifacts/);
  });

  test("strip-only hosts do not call removeOwnedHookArtifacts / script rm on reinstall path", () => {
    for (const [pkg, file] of STRIP_ONLY) {
      const body = src(pkg, file);
      expect(body, pkg).not.toMatch(/removeOwnedHookArtifacts/);
      expect(body, `${pkg} must not gain local removeOwnedScripts`).not.toMatch(
        /function removeOwnedScripts\s*\(/,
      );
      expect(body, `${pkg} must not gain local removeOwnedArtifacts`).not.toMatch(
        /function removeOwnedArtifacts\s*\(/,
      );
    }
  });

  test("copilot/kiro/antigravity use shared removeOwnedHookArtifacts + sidecar read/write", () => {
    for (const [pkg, file] of REMOVE_HOSTS) {
      if (pkg === "integration-windsurf") continue;
      const body = src(pkg, file);
      expect(body, pkg).toMatch(/readHookOwnershipSidecar/);
      expect(body, pkg).toMatch(/writeHookOwnershipSidecar/);
      expect(body, pkg).toMatch(/removeOwnedHookArtifacts/);
      expect(body, `${pkg} still defines local removeOwnedArtifacts`).not.toMatch(
        /function removeOwnedArtifacts\s*\(/,
      );
    }
  });

  test("kiro/antigravity keep thick local copyHookScript (out of shared simple copy)", () => {
    for (const [pkg, file] of [
      ["integration-kiro", "createKiroIntegration.ts"],
      ["integration-antigravity", "createAntigravityIntegration.ts"],
    ] as const) {
      const body = src(pkg, file);
      expect(body, pkg).toMatch(/function copyHookScript\s*\(/);
    }
  });
});
