import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
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
          if (src && existsSync(src)) {
            const skillMd = src.endsWith("SKILL.md") ? src : join(src, "SKILL.md");
            if (existsSync(skillMd) && statSync(skillMd).isFile()) {
              cpSync(skillMd, destFile);
            } else {
              writeFileSync(destFile, readPrimitiveContent(p, "SKILL.md"), "utf8");
            }
          } else {
            writeFileSync(destFile, readPrimitiveContent(p, "SKILL.md"), "utf8");
          }
          deployedFiles.push({ path: toPosixRel(cwd, destFile) });
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
  const incoming = normalizeServerEntries(servers);
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
  };
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

function normalizeServerEntries(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  const list: McpServerConfig[] = Array.isArray(servers)
    ? servers
    : Object.entries(servers).map(([name, value]) => ({
        ...value,
        name: value.name ?? name,
      }));

  for (const server of list) {
    const name = String(server.name ?? "").trim();
    if (!name) continue;
    out[name] = toCursorServerEntry(server);
  }
  return out;
}

function toCursorServerEntry(server: McpServerConfig): Record<string, unknown> {
  const transport = String(server.transport ?? server.type ?? "").toLowerCase();
  const entry: Record<string, unknown> = {};

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

  // Preserve extra keys that are useful for round-trip (except internal meta)
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
      ].includes(key)
    ) {
      continue;
    }
    if (value !== undefined) entry[key] = value;
  }

  return entry;
}
