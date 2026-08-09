/**
 * Shared materialize helpers for host targets (fs/path, primitive content).
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, sep, dirname, basename } from "node:path";
import type {
  AttributedPrimitive,
  AttributedPrimitiveSet,
  BapmIntegration,
  CompileReport,
  ConfigureMcpFn,
  DeployedFile,
} from "./types.ts";

/** Shared command frontmatter allowlist (Cursor / Claude Code / Grok-style prompts). */
export const SHARED_COMMAND_FRONTMATTER_KEYS: ReadonlySet<string> = new Set([
  "description",
  "allowed-tools",
  "model",
  "argument-hint",
  "input",
]);

/** Normalize `AttributedPrimitiveSet` (array or `{ primitives }`) to a list. */
export function primitivesList(set: AttributedPrimitiveSet): AttributedPrimitive[] {
  if (Array.isArray(set)) return set;
  if (set && typeof set === "object" && Array.isArray(set.primitives)) {
    return set.primitives;
  }
  return [];
}

/** Known primitive kinds dispatched by `primitivesMaterialize`. */
export type PrimitiveMaterializeKind = "skill" | "instruction" | "agent" | "command" | "hook";

/** Context passed to each materialize handler. */
export type PrimitiveMaterializeContext = {
  /** Path-safe single segment from `primitive.name`. */
  name: string;
  /** Lowercased `primitive.type` (default `"skill"`). */
  type: string;
};

export type PrimitiveMaterializeHandler = (
  primitive: AttributedPrimitive,
  ctx: PrimitiveMaterializeContext,
) => void | Promise<void>;

/**
 * Host handlers keyed by primitive kind. Missing keys are skipped.
 * `unknown` runs only when the type matches no known kind.
 */
export type PrimitiveMaterializeHandlers = Partial<
  Record<PrimitiveMaterializeKind, PrimitiveMaterializeHandler>
> & {
  unknown?: PrimitiveMaterializeHandler;
};

const KIND_MATCHERS: Array<{ kind: PrimitiveMaterializeKind; test: RegExp }> = [
  { kind: "skill", test: /skill/ },
  { kind: "instruction", test: /instruction/ },
  { kind: "agent", test: /agent/ },
  { kind: "command", test: /command/ },
  { kind: "hook", test: /hook/ },
];

function resolvePrimitiveKind(type: string): PrimitiveMaterializeKind | undefined {
  for (const { kind, test } of KIND_MATCHERS) {
    if (test.test(type)) return kind;
  }
  return undefined;
}

/**
 * Dispatch each primitive to a typed handler (`skill`, `instruction`, …).
 * Prefer this over a manual `primitivesList` + `if (/skill/)` loop in hosts.
 * Known kinds without a handler are skipped; `unknown` covers unmatched types.
 */
export async function primitivesMaterialize(
  set: AttributedPrimitiveSet,
  handlers: PrimitiveMaterializeHandlers,
): Promise<void> {
  for (const primitive of primitivesList(set)) {
    const type = String(primitive.type ?? "skill").toLowerCase();
    const name = sanitizeName(String(primitive.name));
    const ctx: PrimitiveMaterializeContext = { name, type };
    const kind = resolvePrimitiveKind(type);
    const handler = kind ? handlers[kind] : handlers.unknown;
    if (handler) await handler(primitive, ctx);
  }
}

/** Replace path separators so a primitive name is safe as a single path segment. */
export function sanitizeName(name: string): string {
  return String(name || "unnamed").replace(/[/\\]/g, "-");
}

/** True when `absPath` is `rootRel` or a descendant under `cwd`. */
export function isUnderRoot(cwd: string, absPath: string, rootRel: string): boolean {
  const rootAbs = resolve(cwd, rootRel);
  const rel = relative(rootAbs, absPath);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(`..${sep}`));
}

/** Throw if `absPath` is outside every registered deploy root. */
export function assertUnderDeployRoots(cwd: string, absPath: string, deployRoots: string[]): void {
  if (!deployRoots.some((r) => isUnderRoot(cwd, absPath, r))) {
    throw new Error(`materialize refuses path outside deploy roots: ${absPath}`);
  }
}

/**
 * Resolve primitive body: inline `content`, preferred nested file, source file,
 * or minimal frontmatter stub.
 */
export function readPrimitiveContent(p: AttributedPrimitive, preferredFile?: string): string {
  if (typeof p.content === "string") return p.content;
  const src = p.path ? resolve(p.path) : undefined;
  if (src && existsSync(src)) {
    if (preferredFile) {
      const nested = src.endsWith(preferredFile) ? src : join(src, preferredFile);
      if (existsSync(nested) && statSync(nested).isFile()) {
        return readFileSync(nested, "utf8");
      }
    }
    if (statSync(src).isFile()) return readFileSync(src, "utf8");
  }
  const name = sanitizeName(String(p.name));
  return `---\nname: ${name}\n---\n# ${name}\n`;
}

/** Absolute path → cwd-relative path with `/` separators. */
export function toPosixRel(cwd: string, absPath: string): string {
  return relative(cwd, absPath).split(sep).join("/");
}

/**
 * Walk up from `startPath` (file or directory) to the nearest package root
 * marked by `apm.yml`, `bapm.yml`, or `plugin.json`.
 * Falls back to `dirname(startPath)` when no marker is found.
 */
export function findPackageRoot(startPath: string): string {
  let dir =
    existsSync(startPath) && statSync(startPath).isDirectory() ? startPath : dirname(startPath);
  for (;;) {
    if (
      existsSync(join(dir, "apm.yml")) ||
      existsSync(join(dir, "bapm.yml")) ||
      existsSync(join(dir, "plugin.json"))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return existsSync(startPath) && statSync(startPath).isDirectory()
    ? startPath
    : dirname(startPath);
}

/** True when `candidate` is `root` or a descendant (path containment). */
export function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/") && rel !== "..");
}

/** Recursively list files under `dir` (absolute paths). */
export function listFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...listFiles(path));
    else files.push(path);
  }
  return files;
}

function treeIsContained(directory: string, root: string, visited: Set<string>): boolean {
  if (visited.has(directory)) return true;
  visited.add(directory);
  for (const entry of readdirSync(directory)) {
    const resolved = realpathSync(join(directory, entry));
    if (!isWithin(root, resolved)) return false;
    if (statSync(resolved).isDirectory() && !treeIsContained(resolved, root, visited)) return false;
  }
  return true;
}

/**
 * Copy a validated portable Agent Plugin skill directory without retaining symlinks.
 * Throws when the skill escapes `pluginRoot`.
 */
export function copyPortableSkillDirectory(
  sourceDir: string,
  pluginRoot: unknown,
  destDir: string,
): void {
  const source = realpathSync(sourceDir);
  const root = typeof pluginRoot === "string" ? realpathSync(pluginRoot) : undefined;
  if (!root || !isWithin(root, source) || !statSync(source).isDirectory()) {
    throw new Error("Agent Plugin skill directory is outside its plugin root");
  }
  const skillFile = realpathSync(join(source, "SKILL.md"));
  if (
    !isWithin(root, skillFile) ||
    !statSync(skillFile).isFile() ||
    !treeIsContained(source, root, new Set())
  ) {
    throw new Error("Agent Plugin skill contains a path outside its plugin root");
  }
  mkdirSync(destDir, { recursive: true });
  cpSync(source, destDir, { recursive: true, dereference: true, force: true });
}

/**
 * Host-agnostic skill materialize: Agent Plugin tree / SKILL.md copy / content stub.
 * Hosts only choose `destDir` (cwd-relative or absolute under deploy roots).
 */
export function materializeSkill(args: {
  primitive: AttributedPrimitive;
  cwd: string;
  deployRoots: string[];
  /** Destination skill directory (e.g. `.agents/skills/hello` or absolute). */
  destDir: string;
}): DeployedFile[] {
  const { primitive: p, cwd, deployRoots } = args;
  const destDir = resolve(cwd, args.destDir);
  const destFile = join(destDir, "SKILL.md");
  assertUnderDeployRoots(cwd, destFile, deployRoots);
  mkdirSync(destDir, { recursive: true });

  const src = p.path ? resolve(p.path) : undefined;
  if (p.format === "agent-plugin" && typeof p.skillDirectory === "string") {
    copyPortableSkillDirectory(p.skillDirectory, p.pluginRoot, destDir);
  } else if (src && existsSync(src)) {
    const skillMd = src.endsWith("SKILL.md") ? src : join(src, "SKILL.md");
    if (existsSync(skillMd) && statSync(skillMd).isFile()) {
      cpSync(skillMd, destFile);
    } else {
      writeFileSync(destFile, readPrimitiveContent(p, "SKILL.md"), "utf8");
    }
  } else {
    writeFileSync(destFile, readPrimitiveContent(p, "SKILL.md"), "utf8");
  }

  return listFiles(destDir).map((path) => ({
    path: toPosixRel(cwd, path),
    primitive: { name: String(p.name), packageName: p.packageName },
  }));
}

const MCP_CONFIGURE_ALIASES = [
  "configureMcp",
  "writeMcpConfig",
  "deployMcp",
  "configureMcpServers",
] as const;

/** True when the target exposes an MCP configure hook (any documented alias). */
export function hasConfigureMcp(target: BapmIntegration | Record<string, unknown>): boolean {
  return getConfigureMcp(target) !== undefined;
}

/**
 * Resolve optional MCP configure from a registered target.
 * Accepts `configureMcp` and documented aliases without requiring every host to
 * use the same method name.
 */
export function getConfigureMcp(
  target: BapmIntegration | Record<string, unknown>,
): ConfigureMcpFn | undefined {
  const rec = target as Record<string, unknown>;
  for (const key of MCP_CONFIGURE_ALIASES) {
    const fn = rec[key];
    if (typeof fn === "function") {
      return (fn as ConfigureMcpFn).bind(target);
    }
  }
  return undefined;
}

/**
 * Assert deploy-root containment, mkdir parents, write content, return inventory row.
 */
export function writeDeployedFile(args: {
  cwd: string;
  deployRoots: string[];
  /** Destination path relative to `cwd` (or absolute under cwd). */
  destRel: string;
  content: string | Buffer;
  primitive?: { name: string; packageName?: string };
}): DeployedFile {
  const cwd = resolve(args.cwd);
  const destFile = resolve(cwd, args.destRel);
  assertUnderDeployRoots(cwd, destFile, args.deployRoots);
  mkdirSync(dirname(destFile), { recursive: true });
  writeFileSync(destFile, args.content);
  const row: DeployedFile = { path: toPosixRel(cwd, destFile) };
  if (args.primitive) row.primitive = args.primitive;
  return row;
}

function defaultSectionHeading(p: AttributedPrimitive): string {
  return `${p.name} (${p.type})`;
}

/**
 * Deterministic markdown document from attributed primitives (AGENTS.md family).
 */
export function renderPrimitivesMarkdown(args: {
  primitives: AttributedPrimitive[];
  title: string;
  filter?: (p: AttributedPrimitive) => boolean;
  emptyMessage?: string;
  sectionHeading?: (p: AttributedPrimitive) => string;
  preferredFile?: string;
}): string {
  const filtered = args.filter ? args.primitives.filter(args.filter) : args.primitives;
  const sorted = [...filtered].sort((a, b) => {
    const type = String(a.type ?? "").localeCompare(String(b.type ?? ""));
    if (type !== 0) return type;
    const name = String(a.name ?? "").localeCompare(String(b.name ?? ""));
    return name !== 0 ? name : String(a.path ?? "").localeCompare(String(b.path ?? ""));
  });
  const emptyMessage = args.emptyMessage ?? "_No discoverable primitives._";
  const heading = args.sectionHeading ?? defaultSectionHeading;
  const sections = [args.title, "", "<!-- Generated by bapm compile. Do not edit by hand. -->", ""];
  if (sorted.length === 0) return [...sections, emptyMessage, ""].join("\n");

  for (const primitive of sorted) {
    sections.push(`## ${heading(primitive)}`, "");
    sections.push(
      readPrimitiveContent(primitive, args.preferredFile ?? `# ${primitive.name}\n`).trimEnd(),
      "",
    );
  }
  return sections.join("\n");
}

/**
 * Build a `CompileReport` from markdown content; optionally write under cwd.
 */
export function compileMarkdownReport(args: {
  cwd: string;
  outputFile: string;
  write: boolean;
  content: string;
  requireBasename?: string;
  outsideCwdMessage?: string;
}): CompileReport {
  const cwd = resolve(args.cwd);
  const outputPath = resolve(cwd, args.outputFile);
  const rel = relative(cwd, outputPath);
  const sepChar = process.platform === "win32" ? "\\" : "/";
  if (!rel || rel === ".." || rel.startsWith(`..${sepChar}`)) {
    throw new Error(args.outsideCwdMessage ?? "Compile output must be a cwd-relative file path");
  }
  if (args.requireBasename && basename(outputPath) !== args.requireBasename) {
    throw new Error(`Compile output basename must be ${args.requireBasename}`);
  }

  const path = rel.split(sep).join("/");
  const wrote = args.write;
  if (wrote) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, args.content, "utf8");
  }
  return { path, content: args.content, wrote };
}

/**
 * Drop YAML frontmatter keys not in `preserved`; preserve body and non-key lines.
 */
export function filterFrontmatterKeys(
  source: string,
  preserved: ReadonlySet<string>,
): { content: string; droppedKeys: string[] } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { content: source, droppedKeys: [] };

  const rawFm = match[1] ?? "";
  const body = match[2] ?? "";
  const kept: string[] = [];
  const droppedKeys: string[] = [];

  for (const line of rawFm.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const keyMatch = line.match(/^([A-Za-z0-9_-]+)\s*:/);
    if (!keyMatch) {
      kept.push(line);
      continue;
    }
    const key = keyMatch[1]!;
    if (preserved.has(key)) {
      kept.push(line);
    } else {
      droppedKeys.push(key);
    }
  }

  const fmBlock = kept.length > 0 ? `---\n${kept.join("\n")}\n---\n` : "";
  return { content: `${fmBlock}${body}`.replace(/\s+$/, "\n"), droppedKeys };
}

/** Owned-hook sidecar document (hosts write only the fields they need). */
export type HookOwnershipSidecar = {
  owned: Record<
    string,
    {
      packageName?: string;
      entries?: Array<{ event: string; command: string }>;
      scripts?: string[];
      hookFile?: string;
      hookFiles?: string[];
    }
  >;
};

/** Read ownership sidecar; missing/malformed → `{ owned: {} }`. */
export function readHookOwnershipSidecar(path: string): HookOwnershipSidecar {
  if (!existsSync(path)) return { owned: {} };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { owned: {} };
    const owned = (raw as { owned?: unknown }).owned;
    if (!owned || typeof owned !== "object" || Array.isArray(owned)) return { owned: {} };
    return { owned: owned as HookOwnershipSidecar["owned"] };
  } catch {
    return { owned: {} };
  }
}

/** Write `{ owned }` as pretty JSON with trailing newline (caller asserts deploy roots). */
export function writeHookOwnershipSidecar(path: string, doc: HookOwnershipSidecar): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ owned: doc.owned ?? {} }, null, 2)}\n`, "utf8");
}

/**
 * Remove entries whose `command` appears in any owned `entries`.
 * Mutates `hooks` in place; does not delete files from disk.
 */
export function stripOwnedHookCommands(
  hooks: Record<string, unknown>,
  ownership: HookOwnershipSidecar,
): void {
  const ownedCommands = new Set<string>();
  for (const record of Object.values(ownership.owned ?? {})) {
    for (const entry of record.entries ?? []) {
      if (entry.command) ownedCommands.add(entry.command);
    }
  }
  if (ownedCommands.size === 0) return;

  for (const [event, entries] of Object.entries(hooks)) {
    if (!Array.isArray(entries)) continue;
    hooks[event] = entries.filter((e) => {
      const cmd =
        e && typeof e === "object" && typeof (e as { command?: unknown }).command === "string"
          ? (e as { command: string }).command
          : "";
      return !ownedCommands.has(cmd);
    });
  }
}

/**
 * Best-effort delete of owned `scripts`, `hookFile`, and `hookFiles` under `cwd`.
 * Missing paths are ignored; does not mutate hooks JSON.
 */
export function removeOwnedHookArtifacts(cwd: string, ownership: HookOwnershipSidecar): void {
  for (const record of Object.values(ownership.owned ?? {})) {
    const rels: string[] = [];
    if (typeof record.hookFile === "string" && record.hookFile) rels.push(record.hookFile);
    if (Array.isArray(record.hookFiles)) {
      for (const f of record.hookFiles) {
        if (typeof f === "string" && f) rels.push(f);
      }
    }
    if (Array.isArray(record.scripts)) {
      for (const s of record.scripts) {
        if (typeof s === "string" && s) rels.push(s);
      }
    }
    for (const rel of rels) {
      try {
        const abs = join(cwd, rel);
        if (existsSync(abs)) rmSync(abs, { force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }
}

export type CopyHookScriptArgs = {
  cwd: string;
  deployRoots: string[];
  hookFile: string;
  command: string;
  alreadyDeployedNeedle: string;
  destRel: string;
  commandAsDotSlash?: boolean;
};

export type CopyHookScriptResult = {
  commandRel: string;
  scriptRel?: string;
};

/**
 * Simple hook-script copy for hosts that resolve next to the hook file or under
 * `findPackageRoot`, then write a caller-supplied `destRel` under deploy roots.
 */
export function copyHookScript(args: CopyHookScriptArgs): CopyHookScriptResult {
  const { cwd, deployRoots, hookFile, command, alreadyDeployedNeedle, destRel, commandAsDotSlash } =
    args;

  if (command.includes(alreadyDeployedNeedle)) {
    const commandRel = commandAsDotSlash
      ? command.startsWith("./")
        ? command
        : `./${command.replace(/^\//, "")}`
      : command;
    return { commandRel };
  }

  const cleaned = command.replace(/^\.\//, "");
  const packageRoot = findPackageRoot(hookFile);
  const candidates = [resolve(dirname(hookFile), cleaned), resolve(packageRoot, cleaned)];
  const source = candidates.find((p) => {
    try {
      return existsSync(p) && statSync(p).isFile();
    } catch {
      return false;
    }
  });
  if (!source) {
    return { commandRel: command };
  }

  const destAbs = join(cwd, destRel);
  assertUnderDeployRoots(cwd, destAbs, deployRoots);
  mkdirSync(dirname(destAbs), { recursive: true });
  cpSync(source, destAbs);
  const commandRel = commandAsDotSlash ? `./${destRel}` : destRel;
  return { commandRel, scriptRel: destRel };
}
