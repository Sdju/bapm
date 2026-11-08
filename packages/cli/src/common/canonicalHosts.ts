/**
 * Known published host ids → default `@b-apm/integration-<id>` specifier.
 * Used when object-map `targets:` omits a host (canonical fallback load).
 */
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

/** Host ids with a published `@b-apm/integration-*` package in this monorepo. */
export const CANONICAL_HOST_IDS = [
  "cursor",
  "opencode",
  "copilot",
  "windsurf",
  "kiro",
  "grok-bot",
  "grok-build",
  "hermes",
  "intellij",
  "antigravity",
  "agent-skills",
  "claude",
  "codex",
  "gemini",
] as const;

export type CanonicalHostId = (typeof CANONICAL_HOST_IDS)[number];

export function isCanonicalHostId(id: string): id is CanonicalHostId {
  return (CANONICAL_HOST_IDS as readonly string[]).includes(id);
}

/** Default npm specifier for a known host id. */
export function canonicalPackageSpecifier(hostId: string): string {
  return `@b-apm/integration-${hostId}`;
}

function isDir(cwd: string, rel: string): boolean {
  const p = join(cwd, rel);
  return existsSync(p) && statSync(p).isDirectory();
}

function isFile(cwd: string, rel: string): boolean {
  const p = join(cwd, rel);
  return existsSync(p) && statSync(p).isFile();
}

type CanonicalHostMarkerProbe = {
  id: CanonicalHostId;
  path: string;
  kind: "dir" | "file";
};

const CANONICAL_HOST_MARKER_PROBES: readonly CanonicalHostMarkerProbe[] = [
  { id: "cursor", path: ".cursor", kind: "dir" },
  { id: "cursor", path: ".cursorrules", kind: "file" },
  { id: "opencode", path: ".opencode", kind: "dir" },
  { id: "opencode", path: "opencode.json", kind: "file" },
  { id: "opencode", path: "opencode.jsonc", kind: "file" },
  { id: "copilot", path: ".github/copilot-instructions.md", kind: "file" },
  { id: "copilot", path: ".github/instructions", kind: "dir" },
  { id: "copilot", path: ".github/agents", kind: "dir" },
  { id: "copilot", path: ".github/prompts", kind: "dir" },
  { id: "copilot", path: ".github/hooks", kind: "dir" },
  { id: "windsurf", path: ".windsurf", kind: "dir" },
  { id: "kiro", path: ".kiro", kind: "dir" },
  { id: "grok-build", path: ".grok", kind: "dir" },
  { id: "claude", path: ".claude", kind: "dir" },
  { id: "claude", path: "CLAUDE.md", kind: "file" },
  { id: "codex", path: ".codex", kind: "dir" },
  { id: "gemini", path: ".gemini", kind: "dir" },
  { id: "gemini", path: "GEMINI.md", kind: "file" },
];

export type DetectedCanonicalHost = {
  id: CanonicalHostId;
  markers: string[];
};

/**
 * Detailed marker probe: canonical `id` plus every matched relative marker.
 * Mirrors the published integration `detect` checks without loading packages.
 */
export function probeCanonicalHostMarkersDetailed(cwd: string): DetectedCanonicalHost[] {
  const byHost = new Map<CanonicalHostId, string[]>();
  for (const probe of CANONICAL_HOST_MARKER_PROBES) {
    const matched = probe.kind === "dir" ? isDir(cwd, probe.path) : isFile(cwd, probe.path);
    if (!matched) continue;
    const markers = byHost.get(probe.id) ?? [];
    markers.push(probe.path);
    byHost.set(probe.id, markers);
  }
  return [...byHost.entries()].map(([id, markers]) => ({ id, markers }));
}

/**
 * Lightweight filesystem probe mirroring published integration `detect` markers.
 * Used only for diagnostics when the package is not registered (not for selection).
 */
export function probeCanonicalHostMarkers(cwd: string): string[] {
  return probeCanonicalHostMarkersDetailed(cwd).map((host) => host.id);
}
