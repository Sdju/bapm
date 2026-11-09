/**
 * Host migration to shared hook helpers.
 *
 * Event-map hosts (Cursor/Claude/Gemini/Codex/Windsurf) share the full
 * `mergeHookDeployment` pipeline. Per-file and container hosts keep their
 * local orchestration but use the shared sidecar/artifact helpers.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const MERGE_DEPLOYMENT_HOSTS = [
  ["integration-cursor", "createCursorIntegration.ts"],
  ["integration-claude", "createClaudeIntegration.ts"],
  ["integration-gemini", "createGeminiIntegration.ts"],
  ["integration-codex", "createCodexIntegration.ts"],
  ["integration-windsurf", "createWindsurfIntegration.ts"],
] as const;

const STRIP_ONLY = [
  ["integration-cursor", "createCursorIntegration.ts"],
  ["integration-claude", "createClaudeIntegration.ts"],
  ["integration-gemini", "createGeminiIntegration.ts"],
  ["integration-codex", "createCodexIntegration.ts"],
] as const;

const REMOVE_HOSTS = [
  ["integration-copilot", "createCopilotIntegration.ts"],
  ["integration-kiro", "createKiroIntegration.ts"],
  ["integration-antigravity", "createAntigravityIntegration.ts"],
] as const;

function hostSrc(pkg: string, file: string): string {
  return join(repoRoot, "packages", pkg, "src", file);
}

function src(pkg: string, file: string): string {
  return readFileSync(hostSrc(pkg, file), "utf8");
}

describe("host migration to shared hook helpers", () => {
  test("event-map hosts use the shared mergeHookDeployment pipeline", () => {
    for (const [pkg, file] of MERGE_DEPLOYMENT_HOSTS) {
      const body = src(pkg, file);
      expect(body, pkg).toMatch(/\bmergeHookDeployment\b/);
      expect(body, `${pkg} still defines local copyHookScript`).not.toMatch(
        /function copyHookScript\s*\(/,
      );
      expect(body, `${pkg} still defines local readOwnershipSidecar`).not.toMatch(
        /function readOwnershipSidecar\s*\(/,
      );
    }
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
