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
  BapmIntegration,
  ConfigureMcpContext,
  ConfigureMcpReport,
  MaterializeReport,
  McpServerConfig,
} from "@bapm/integration-api";
import {
  assertUnderDeployRoots,
  primitivesList,
  readPrimitiveContent,
  sanitizeName,
  toPosixRel,
} from "@bapm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".opencode", "."] as const;
const MCP_JSON_REL = "opencode.json";

/**
 * Create the OpenCode target.
 * Detect: `.opencode/` directory **or** `opencode.json` / `opencode.jsonc`.
 * Materialize: skills → `.opencode/skills/<name>/SKILL.md`,
 * agents → `.opencode/agents/<name>.md`,
 * commands → `.opencode/commands/<name>.md`,
 * hooks → explicit non-fatal skip (not supported on OpenCode).
 * MCP: optional `configureMcp` writes project `opencode.json` (not via materialize).
 */
export function createOpencodeIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  const id = options?.id ?? "opencode";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    detect: ({ cwd }) => {
      const opencodeDir = join(cwd, ".opencode");
      if (existsSync(opencodeDir) && statSync(opencodeDir).isDirectory()) return true;
      const json = join(cwd, "opencode.json");
      if (existsSync(json) && statSync(json).isFile()) return true;
      const jsonc = join(cwd, "opencode.jsonc");
      return existsSync(jsonc) && statSync(jsonc).isFile();
    },
    getDeployRoots: () => [...deployRoots],
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const cwd = resolve(ctx?.cwd ?? process.cwd());
      const roots = ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots;
      if (!roots.some((r) => r === ".opencode" || r.startsWith(".opencode"))) {
        throw new Error("opencode target missing .opencode deploy root");
      }

      const deployedFiles: MaterializeReport["deployedFiles"] = [];
      const diagnostics: NonNullable<MaterializeReport["diagnostics"]> = [];

      for (const p of primitivesList(primitives)) {
        const type = String(p.type ?? "skill").toLowerCase();
        const name = sanitizeName(String(p.name));

        if (/skill/.test(type)) {
          const destDir = join(cwd, ".opencode", "skills", name);
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
            deployedFiles.push({
              path: toPosixRel(cwd, path),
              primitive: { name: String(p.name), packageName: p.packageName },
            });
          }
          continue;
        }

        if (/agent/.test(type)) {
          const destFile = join(cwd, ".opencode", "agents", `${name}.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(join(cwd, ".opencode", "agents"), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({
            path: toPosixRel(cwd, destFile),
            primitive: { name: String(p.name), packageName: p.packageName },
          });
          continue;
        }

        if (/command/.test(type)) {
          const destFile = join(cwd, ".opencode", "commands", `${name}.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(join(cwd, ".opencode", "commands"), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({
            path: toPosixRel(cwd, destFile),
            primitive: { name: String(p.name), packageName: p.packageName },
          });
          continue;
        }

        if (/hook/.test(type)) {
          diagnostics.push({
            code: "OPENCODE_HOOKS_UNSUPPORTED",
            message: `OpenCode does not support hooks; skipping hook "${p.name}" (not supported)`,
            primitive: String(p.name),
          });
          continue;
        }

        // instructions and other types: skip (no OpenCode rules mapping in v1)
      }

      return {
        targetId: id,
        deployedFiles,
        ...(diagnostics.length > 0 ? { diagnostics } : {}),
      };
    },
    async configureMcp(servers, ctx): Promise<ConfigureMcpReport> {
      return writeOpencodeMcpConfig(servers, {
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

function writeOpencodeMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; deployRoots: string[] },
): ConfigureMcpReport {
  const { cwd, deployRoots } = ctx;
  if (!deployRoots.some((r) => r === "." || r === "./")) {
    throw new Error(
      "opencode configureMcp requires a registered '.' deploy root for opencode.json",
    );
  }

  const destFile = join(cwd, MCP_JSON_REL);
  assertUnderDeployRoots(cwd, destFile, deployRoots);

  const existingDoc = readExistingOpencodeDoc(destFile);
  const existingMcp =
    existingDoc.mcp && typeof existingDoc.mcp === "object" && !Array.isArray(existingDoc.mcp)
      ? { ...(existingDoc.mcp as Record<string, Record<string, unknown>>) }
      : {};

  const { entries: incoming, diagnostics } = normalizeServerEntries(servers);
  const nextMcp: Record<string, Record<string, unknown>> = { ...existingMcp };

  const writtenNames: string[] = [];
  for (const [name, entry] of Object.entries(incoming)) {
    nextMcp[name] = entry;
    writtenNames.push(name);
  }

  const doc: Record<string, unknown> = { ...existingDoc, mcp: nextMcp };
  writeFileSync(destFile, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

  return {
    targetId: ctx.targetId,
    configPath: MCP_JSON_REL,
    servers: writtenNames,
    deployedFiles: [{ path: MCP_JSON_REL }],
    diagnostics,
  };
}

function readExistingOpencodeDoc(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
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
    const entry = toOpencodeServerEntry(server);
    if (!entry) {
      diagnostics.push({
        code: "OPENCODE_PORTABLE_MCP_UNSUPPORTED",
        message: `OpenCode cannot faithfully represent MCP server "${name}" (unsupported transport)`,
        server: name,
      });
      continue;
    }
    out[name] = entry;
  }
  return { entries: out, diagnostics };
}

function toOpencodeServerEntry(server: McpServerConfig): Record<string, unknown> | undefined {
  const transport = String(server.transport ?? server.type ?? "").toLowerCase();
  const portable = server.format === "agent-plugin";

  if (transport === "sse") {
    // OpenCode documents local/remote only — fail closed for SSE.
    return undefined;
  }

  if (portable) {
    if (transport === "stdio") {
      if (typeof server.command !== "string") return undefined;
      return buildLocalEntry(server);
    }
    if (transport === "streamable-http" || transport === "http") {
      if (typeof server.url !== "string") return undefined;
      return buildRemoteEntry(server);
    }
    return undefined;
  }

  if (transport === "http" || transport === "streamable-http" || typeof server.url === "string") {
    if (typeof server.url !== "string") return undefined;
    if (transport === "stdio") {
      // Prefer explicit stdio when both somehow present — unusual; treat as local.
      return buildLocalEntry(server);
    }
    return buildRemoteEntry(server);
  }

  if (transport === "stdio" || transport === "local" || typeof server.command === "string") {
    if (typeof server.command !== "string") return undefined;
    return buildLocalEntry(server);
  }

  return undefined;
}

function buildLocalEntry(server: McpServerConfig): Record<string, unknown> {
  const command = [String(server.command)];
  if (Array.isArray(server.args)) {
    for (const arg of server.args) command.push(String(arg));
  }
  const entry: Record<string, unknown> = { type: "local", command };
  const env = server.env ?? (server as { environment?: Record<string, string> }).environment;
  if (env && typeof env === "object") entry.environment = env;
  return entry;
}

function buildRemoteEntry(server: McpServerConfig): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    type: "remote",
    url: String(server.url),
  };
  const headers = server.headers;
  if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    entry.headers = headers;
  }
  return entry;
}
