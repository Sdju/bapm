import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import type {
  BapmTarget,
  ConfigureMcpContext,
  ConfigureMcpReport,
  MaterializeReport,
  McpServerConfig,
} from "bapm-target-api";
import {
  assertUnderDeployRoots,
  primitivesList,
  readPrimitiveContent,
  sanitizeName,
  toPosixRel,
} from "bapm-target-api";

const DEFAULT_DEPLOY_ROOTS = [".agents/skills", ".cursor"] as const;
const MCP_JSON_REL = ".cursor/mcp.json";

/**
 * Create the Cursor target.
 * Detect: `.cursor/` directory **or** legacy `.cursorrules` file.
 * Materialize: skills → `.agents/skills/<name>/SKILL.md`,
 * instructions → `.cursor/rules/<name>.mdc`,
 * agents → `.cursor/agents/<name>.md`.
 * MCP: optional `configureMcp` writes `.cursor/mcp.json` (not via materialize).
 */
export function createCursorTarget(options?: { id?: string; deployRoots?: string[] }): BapmTarget {
  const id = options?.id ?? "cursor";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    detect: ({ cwd }) => {
      const cursorDir = join(cwd, ".cursor");
      if (existsSync(cursorDir) && statSync(cursorDir).isDirectory()) return true;
      const legacy = join(cwd, ".cursorrules");
      return existsSync(legacy) && statSync(legacy).isFile();
    },
    getDeployRoots: () => [...deployRoots],
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const cwd = resolve(ctx?.cwd ?? process.cwd());
      const roots = ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots;
      if (!roots.some((r) => r === ".agents/skills" || r.startsWith(".agents/skills"))) {
        throw new Error("cursor target missing .agents/skills deploy root");
      }
      if (!roots.some((r) => r === ".cursor" || r.startsWith(".cursor"))) {
        throw new Error("cursor target missing .cursor deploy root");
      }

      const deployedFiles: MaterializeReport["deployedFiles"] = [];

      for (const p of primitivesList(primitives)) {
        const type = String(p.type ?? "skill").toLowerCase();
        const name = sanitizeName(String(p.name));

        if (/skill/.test(type)) {
          const destDir = join(cwd, ".agents", "skills", name);
          const destFile = join(destDir, "SKILL.md");
          assertUnderDeployRoots(cwd, destFile, roots);
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
          for (const path of listFiles(destDir)) {
            deployedFiles.push({ path: toPosixRel(cwd, path) });
          }
          continue;
        }

        if (/instruction/.test(type)) {
          const destFile = join(cwd, ".cursor", "rules", `${name}.mdc`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(join(cwd, ".cursor", "rules"), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({ path: toPosixRel(cwd, destFile) });
          continue;
        }

        if (/agent/.test(type)) {
          const destFile = join(cwd, ".cursor", "agents", `${name}.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(join(cwd, ".cursor", "agents"), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({ path: toPosixRel(cwd, destFile) });
          continue;
        }

        // commands/hooks and other types: skip (not required for M5)
      }

      return { deployedFiles };
    },
    async configureMcp(servers, ctx): Promise<ConfigureMcpReport> {
      return writeCursorMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
      });
    },
  };
}

/** Copy a validated portable skill directory without retaining symlinks. */
function copyPortableSkillDirectory(sourceDir: string, pluginRoot: unknown, destDir: string): void {
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

function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/") && rel !== "..");
}

function listFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...listFiles(path));
    else files.push(path);
  }
  return files;
}

function writeCursorMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; deployRoots: string[] },
): ConfigureMcpReport {
  const { cwd, deployRoots } = ctx;
  if (!deployRoots.some((r) => r === ".cursor" || r.startsWith(".cursor"))) {
    throw new Error("cursor configureMcp requires a registered .cursor deploy root");
  }

  const destFile = join(cwd, ".cursor", "mcp.json");
  assertUnderDeployRoots(cwd, destFile, deployRoots);
  mkdirSync(join(cwd, ".cursor"), { recursive: true });

  const existing = readExistingMcpServers(destFile);
  const { entries: incoming, diagnostics } = normalizeServerEntries(servers);
  const next: Record<string, Record<string, unknown>> = { ...existing };

  const writtenNames: string[] = [];
  for (const [name, entry] of Object.entries(incoming)) {
    next[name] = entry;
    writtenNames.push(name);
  }

  const doc = { mcpServers: next };
  writeFileSync(destFile, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

  return {
    configPath: MCP_JSON_REL,
    servers: writtenNames,
    deployedFiles: [{ path: MCP_JSON_REL }],
    diagnostics,
  } as ConfigureMcpReport;
}

function readExistingMcpServers(path: string): Record<string, Record<string, unknown>> {
  if (!existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      mcpServers?: Record<string, Record<string, unknown>>;
    };
    return raw.mcpServers && typeof raw.mcpServers === "object" ? { ...raw.mcpServers } : {};
  } catch {
    return {};
  }
}

function normalizeServerEntries(servers: McpServerConfig[] | Record<string, McpServerConfig>): {
  entries: Record<string, Record<string, unknown>>;
  diagnostics: Array<{ code: string; message: string; server?: string }>;
} {
  const out: Record<string, Record<string, unknown>> = {};
  const diagnostics: Array<{ code: string; message: string; server?: string }> = [];
  const list: McpServerConfig[] = Array.isArray(servers)
    ? servers
    : Object.entries(servers).map(([name, value]) => ({
        ...value,
        name: value.name ?? name,
      }));

  for (const server of list) {
    const name = String(server.name ?? "").trim();
    if (!name) continue;
    const entry = toCursorServerEntry(server);
    if (!entry) {
      diagnostics.push({
        code: "CURSOR_PORTABLE_MCP_UNSUPPORTED",
        message: `Cursor cannot faithfully represent portable MCP server "${name}"`,
        server: name,
      });
      continue;
    }
    out[name] = entry;
  }
  return { entries: out, diagnostics };
}

function toCursorServerEntry(server: McpServerConfig): Record<string, unknown> | undefined {
  const transport = String(server.transport ?? server.type ?? "").toLowerCase();
  const entry: Record<string, unknown> = {};
  const portable = server.format === "agent-plugin";

  if (portable) {
    // Portable v1 is deliberately adapted field-by-field, never copied as Cursor JSON.
    if (transport === "stdio") {
      if (typeof server.command !== "string") return undefined;
      entry.command = server.command;
      if (Array.isArray(server.args)) entry.args = server.args;
      if (typeof server.cwd === "string") entry.cwd = server.cwd;
      entry.type = "stdio";
    } else if (transport === "streamable-http" || transport === "sse") {
      if (typeof server.url !== "string") return undefined;
      entry.url = server.url;
      entry.type = transport === "streamable-http" ? "http" : "sse";
    } else {
      return undefined;
    }
    if (server.env && typeof server.env === "object") entry.env = server.env;
    return entry;
  }

  if (transport === "http" || transport === "sse" || typeof server.url === "string") {
    if (server.url) entry.url = server.url;
    if (transport) entry.type = transport === "sse" ? "sse" : "http";
  } else {
    // stdio default
    if (server.command) entry.command = server.command;
    if (Array.isArray(server.args)) entry.args = server.args;
    entry.type = "stdio";
  }

  if (server.env && typeof server.env === "object") {
    entry.env = server.env;
  }

  // Preserve native extra keys, but never portable adapter metadata.
  for (const [key, value] of Object.entries(server)) {
    if (
      [
        "name",
        "transport",
        "type",
        "command",
        "args",
        "url",
        "env",
        "packageName",
        "registry",
        "format",
        "cwd",
      ].includes(key)
    ) {
      continue;
    }
    if (value !== undefined) entry[key] = value;
  }

  return entry;
}
