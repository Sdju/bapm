/**
 * Create the Grok Build target.
 * Detect: project-root `.grok/` directory only (not lone `AGENTS.md`).
 * Materialize: skills → `.grok/skills/<name>/SKILL.md`,
 * instructions → `.grok/rules/<name>.md` (verbatim),
 * agents → `.grok/agents/<name>.md`,
 * commands → `.grok/commands/<name>.md` (Claude-subset frontmatter),
 * hooks/prompts → non-fatal skip diagnostics.
 * No `configureMcp` (APM N).
 * Compile: project-root `AGENTS.md` (agents compile family).
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import type {
  AttributedPrimitive,
  BapmIntegration,
  CompileContext,
  CompileReport,
  MaterializeReport,
} from "@bapm/integration-api";
import {
  assertUnderDeployRoots,
  materializeSkill,
  primitivesList,
  primitivesMaterialize,
  readPrimitiveContent,
  toPosixRel,
} from "@bapm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".grok", "."] as const;
const COMMAND_PRESERVED_FRONTMATTER = new Set([
  "description",
  "allowed-tools",
  "model",
  "argument-hint",
  "input",
]);

export function createGrokBuildIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  const id = options?.id ?? "grok-build";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    detect: ({ cwd }) => {
      const grokDir = join(cwd, ".grok");
      return existsSync(grokDir) && statSync(grokDir).isDirectory();
    },
    getDeployRoots: () => [...deployRoots],
    async compile(primitives, context): Promise<CompileReport> {
      return compileGrokAgentsMd(primitivesList(primitives), context);
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const cwd = resolve(ctx?.cwd ?? process.cwd());
      const roots = ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots;
      if (!roots.some((r) => r === ".grok" || r.startsWith(".grok"))) {
        throw new Error("grok-build target missing .grok deploy root");
      }

      const deployedFiles: MaterializeReport["deployedFiles"] = [];
      const diagnostics: NonNullable<MaterializeReport["diagnostics"]> = [];

      await primitivesMaterialize(primitives, {
        skill(p, { name }) {
          deployedFiles.push(
            ...materializeSkill({
              primitive: p,
              cwd,
              deployRoots: roots,
              destDir: join(".grok", "skills", name),
            }),
          );
        },
        instruction(p, { name }) {
          const destFile = join(cwd, ".grok", "rules", `${name}.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(join(cwd, ".grok", "rules"), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({
            path: toPosixRel(cwd, destFile),
            primitive: { name: String(p.name), packageName: p.packageName },
          });
        },
        agent(p, { name }) {
          const destFile = join(cwd, ".grok", "agents", `${name}.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(join(cwd, ".grok", "agents"), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({
            path: toPosixRel(cwd, destFile),
            primitive: { name: String(p.name), packageName: p.packageName },
          });
        },
        command(p, { name }) {
          const destFile = join(cwd, ".grok", "commands", `${name}.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(join(cwd, ".grok", "commands"), { recursive: true });
          const { content, droppedKeys } = transformGrokCommandMarkdown(readPrimitiveContent(p));
          writeFileSync(destFile, content, "utf8");
          deployedFiles.push({
            path: toPosixRel(cwd, destFile),
            primitive: { name: String(p.name), packageName: p.packageName },
          });
          if (droppedKeys.length > 0) {
            diagnostics.push({
              code: "GROK_BUILD_COMMAND_FRONTMATTER_DROPPED",
              message: `Dropped non-preserved command frontmatter keys for "${p.name}": ${droppedKeys.join(", ")}`,
              primitive: String(p.name),
              droppedKeys,
            });
          }
        },
        hook(p) {
          diagnostics.push({
            code: "GROK_BUILD_HOOKS_UNSUPPORTED",
            message: `Grok Build does not support hooks; skipping hook "${p.name}"`,
            primitive: String(p.name),
            kind: "hook",
          });
        },
        unknown(p, { type }) {
          if (/prompt/i.test(type)) {
            diagnostics.push({
              code: "GROK_BUILD_PROMPTS_UNSUPPORTED",
              message: `Grok Build does not support prompts; skipping prompt "${p.name}"`,
              primitive: String(p.name),
              kind: "prompt",
            });
          }
        },
      });

      return {
        targetId: id,
        deployedFiles,
        ...(diagnostics.length > 0 ? { diagnostics } : {}),
      };
    },
  };
}

function compileGrokAgentsMd(
  primitives: AttributedPrimitive[],
  context: CompileContext,
): CompileReport {
  const cwd = resolve(context.cwd);
  const outputFile = context.outputFile ?? "AGENTS.md";
  const outputPath = resolve(cwd, outputFile);
  const rel = relative(cwd, outputPath);
  if (!rel || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error("Grok Build compile output must be a cwd-relative file path");
  }
  if (basename(outputPath) !== "AGENTS.md") {
    throw new Error("Grok Build compile output basename must be AGENTS.md");
  }

  const content = renderGrokAgentsMd(primitives);
  const wrote = context.write;
  if (wrote) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, "utf8");
  }

  return { path: rel.replace(/\\/g, "/"), content, wrote };
}

function renderGrokAgentsMd(primitives: AttributedPrimitive[]): string {
  const sorted = [...primitives].sort((a, b) => {
    const type = String(a.type ?? "").localeCompare(String(b.type ?? ""));
    if (type !== 0) return type;
    const name = String(a.name ?? "").localeCompare(String(b.name ?? ""));
    return name !== 0 ? name : String(a.path ?? "").localeCompare(String(b.path ?? ""));
  });
  const sections = [
    "# AGENTS.md",
    "",
    "<!-- Generated by bapm compile. Do not edit by hand. -->",
    "",
  ];
  if (sorted.length === 0) return [...sections, "_No discoverable primitives._", ""].join("\n");

  for (const primitive of sorted) {
    sections.push(`## ${primitive.name} (${primitive.type})`, "");
    sections.push(readPrimitiveContent(primitive, `# ${primitive.name}\n`).trimEnd(), "");
  }
  return sections.join("\n");
}

function transformGrokCommandMarkdown(source: string): {
  content: string;
  droppedKeys: string[];
} {
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
    if (COMMAND_PRESERVED_FRONTMATTER.has(key)) {
      kept.push(line);
    } else {
      droppedKeys.push(key);
    }
  }

  const fmBlock = kept.length > 0 ? `---\n${kept.join("\n")}\n---\n` : "";
  return { content: `${fmBlock}${body}`.replace(/\s+$/, "\n"), droppedKeys };
}
