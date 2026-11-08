/**
 * Core opt-in distributed compile: applyTo placement, root/global retention,
 * target selection, safety, and single-file default regression.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compileAgentsMd } from "../../src/index.ts";
import {
  compileMarkdownReport,
  createIntegrationRegistry,
  primitivesList,
  renderPrimitivesMarkdown,
  type AttributedPrimitive,
  type BapmIntegration,
} from "@b-apm/integration-api";

type TempProject = { cwd: string; cleanup: () => void };

function createTempProject(): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-compile-distributed-"));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

function writeProject(cwd: string): void {
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  writeText(
    join(cwd, "bapm.yml"),
    "name: compile-distributed\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm: []\n",
  );
}

function writeInstruction(cwd: string, name: string, contents: string): void {
  writeText(join(cwd, ".apm", "instructions", name), contents);
}

function fakeHost(
  id: string,
  defaultPath: string,
  options: { includeAll?: boolean } = {},
): BapmIntegration {
  return {
    id,
    deployRoots: [],
    detect: () => true,
    materialize: () => {},
    compile: async (primitives, context) => {
      const content = renderPrimitivesMarkdown({
        primitives: primitivesList(primitives),
        title: `# ${id}`,
        ...(options.includeAll
          ? {}
          : {
              filter: (p: AttributedPrimitive) =>
                context.includeInstructions === true || !/instruction/i.test(String(p.type ?? "")),
            }),
      });
      return compileMarkdownReport({
        cwd: context.cwd,
        outputFile: context.outputFile ?? defaultPath,
        write: context.write,
        content,
      });
    },
  };
}

function registryWith(...hosts: Array<ReturnType<typeof fakeHost>>) {
  const registry = createIntegrationRegistry();
  for (const host of hosts) registry.register(host);
  return registry;
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("compileAgentsMd --distributed", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("applyTo src/** writes src/AGENTS.md and omits an empty root file", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(
      project.cwd,
      "style.md",
      '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nPrefer concise answers.\n',
    );

    const result = await compileAgentsMd({
      cwd: project.cwd,
      distributed: true,
      forcedTarget: "cursor",
      integrationRegistry: registryWith(fakeHost("cursor", "AGENTS.md")),
    });

    expect(result.ok).toBe(true);
    expect(result.outputs).toEqual([{ targetId: "cursor", path: "src/AGENTS.md", wrote: true }]);
    expect(existsSync(join(project.cwd, "src", "AGENTS.md"))).toBe(true);
    expect(read(join(project.cwd, "src", "AGENTS.md"))).toMatch(/Prefer concise answers/);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("multiple applyTo globs place the instruction in every matched directory", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(
      project.cwd,
      "style.md",
      '---\ndescription: Style\napplyTo:\n  - "src/**"\n  - "docs/**/*.md"\n---\n\n# Style\nShared rule.\n',
    );

    const result = await compileAgentsMd({
      cwd: project.cwd,
      distributed: true,
      forcedTarget: "cursor",
      integrationRegistry: registryWith(fakeHost("cursor", "AGENTS.md")),
    });

    expect(result.outputs.map((output) => output.path)).toEqual([
      "docs/AGENTS.md",
      "src/AGENTS.md",
    ]);
    expect(read(join(project.cwd, "docs", "AGENTS.md"))).toMatch(/Shared rule/);
    expect(read(join(project.cwd, "src", "AGENTS.md"))).toMatch(/Shared rule/);
  });

  test("comma-separated applyTo places in each directory", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(
      project.cwd,
      "style.md",
      '---\ndescription: Style\napplyTo: "src/**, docs/*.md"\n---\n\n# Style\nComma rule.\n',
    );

    await compileAgentsMd({
      cwd: project.cwd,
      distributed: true,
      forcedTarget: "cursor",
      integrationRegistry: registryWith(fakeHost("cursor", "AGENTS.md")),
    });

    expect(existsSync(join(project.cwd, "src", "AGENTS.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "docs", "AGENTS.md"))).toBe(true);
  });

  test("global instruction stays at root while applyTo instruction is distributed", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(
      project.cwd,
      "global.md",
      "---\ndescription: Global\n---\n\n# Global\nApplies everywhere.\n",
    );
    writeInstruction(
      project.cwd,
      "style.md",
      '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nOnly in src.\n',
    );

    const result = await compileAgentsMd({
      cwd: project.cwd,
      distributed: true,
      forcedTarget: "cursor",
      integrationRegistry: registryWith(fakeHost("cursor", "AGENTS.md")),
    });

    expect(result.outputs.map((output) => output.path)).toEqual(["AGENTS.md", "src/AGENTS.md"]);
    const root = read(join(project.cwd, "AGENTS.md"));
    expect(root).toMatch(/Applies everywhere/);
    expect(root).not.toMatch(/Only in src/);
    const src = read(join(project.cwd, "src", "AGENTS.md"));
    expect(src).toMatch(/Only in src/);
    expect(src).not.toMatch(/Applies everywhere/);
  });

  test("root-only glob **/*.ts stays in the root file", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(
      project.cwd,
      "style.md",
      '---\ndescription: Style\napplyTo: "**/*.ts"\n---\n\n# Style\nTypeScript rule.\n',
    );

    const result = await compileAgentsMd({
      cwd: project.cwd,
      distributed: true,
      forcedTarget: "cursor",
      integrationRegistry: registryWith(fakeHost("cursor", "AGENTS.md")),
    });

    expect(result.outputs.map((output) => output.path)).toEqual(["AGENTS.md"]);
    expect(read(join(project.cwd, "AGENTS.md"))).toMatch(/TypeScript rule/);
  });

  test("distributed target selection emits only the chosen host", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(
      project.cwd,
      "style.md",
      '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nSelected rule.\n',
    );

    const result = await compileAgentsMd({
      cwd: project.cwd,
      distributed: true,
      forcedTarget: "claude",
      integrationRegistry: registryWith(
        fakeHost("cursor", "AGENTS.md"),
        fakeHost("claude", "CLAUDE.md"),
      ),
    });

    expect(result.outputs).toEqual([{ targetId: "claude", path: "src/CLAUDE.md", wrote: true }]);
    expect(existsSync(join(project.cwd, "src", "CLAUDE.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "src", "AGENTS.md"))).toBe(false);
  });

  test("host-specific nested default keeps its directory and basename", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(
      project.cwd,
      "style.md",
      '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nNested rule.\n',
    );

    const result = await compileAgentsMd({
      cwd: project.cwd,
      distributed: true,
      forcedTarget: "copilot",
      integrationRegistry: registryWith(fakeHost("copilot", ".github/copilot-instructions.md")),
    });

    expect(result.outputs).toEqual([
      { targetId: "copilot", path: ".github/src/copilot-instructions.md", wrote: true },
    ]);
    expect(existsSync(join(project.cwd, ".github", "src", "copilot-instructions.md"))).toBe(true);
  });

  test("dry-run and validate compute placements without writing", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(
      project.cwd,
      "style.md",
      '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nNo write.\n',
    );

    const dry = await compileAgentsMd({
      cwd: project.cwd,
      distributed: true,
      dryRun: true,
      forcedTarget: "cursor",
      integrationRegistry: registryWith(fakeHost("cursor", "AGENTS.md")),
    });
    expect(dry.wrote).toBe(false);
    expect(dry.outputs).toEqual([{ targetId: "cursor", path: "src/AGENTS.md", wrote: false }]);

    const validate = await compileAgentsMd({
      cwd: project.cwd,
      distributed: true,
      validate: true,
      forcedTarget: "cursor",
      integrationRegistry: registryWith(fakeHost("cursor", "AGENTS.md")),
    });
    expect(validate.wrote).toBe(false);
    expect(existsSync(join(project.cwd, "src", "AGENTS.md"))).toBe(false);
  });

  test("escaping applyTo pattern fails closed", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(
      project.cwd,
      "style.md",
      '---\ndescription: Style\napplyTo: "../outside/**"\n---\n\n# Style\nEscape.\n',
    );

    await expect(
      compileAgentsMd({
        cwd: project.cwd,
        distributed: true,
        forcedTarget: "cursor",
        integrationRegistry: registryWith(fakeHost("cursor", "AGENTS.md")),
      }),
    ).rejects.toThrow(/escapes the project|escape/i);

    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("symlinked target directory fails closed", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    const outside = createTempProject();
    try {
      symlinkSync(outside.cwd, join(project.cwd, "src"), "dir");
      writeInstruction(
        project.cwd,
        "style.md",
        '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nSymlink.\n',
      );

      await expect(
        compileAgentsMd({
          cwd: project.cwd,
          distributed: true,
          forcedTarget: "cursor",
          integrationRegistry: registryWith(fakeHost("cursor", "AGENTS.md")),
        }),
      ).rejects.toThrow(/symlink/i);

      expect(existsSync(join(outside.cwd, "AGENTS.md"))).toBe(false);
    } finally {
      outside.cleanup();
    }
  });

  test("distributed rejects a single -o output override", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(
      project.cwd,
      "style.md",
      '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nNo override.\n',
    );

    await expect(
      compileAgentsMd({
        cwd: project.cwd,
        distributed: true,
        outputFile: "OUT.md",
        forcedTarget: "cursor",
        integrationRegistry: registryWith(fakeHost("cursor", "AGENTS.md")),
      }),
    ).rejects.toThrow(/distributed.*--output|--output.*distributed/i);

    expect(existsSync(join(project.cwd, "OUT.md"))).toBe(false);
  });

  test("without distributed an applyTo instruction remains in the single root file", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(
      project.cwd,
      "style.md",
      '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nSingle file.\n',
    );

    const result = await compileAgentsMd({
      cwd: project.cwd,
      forcedTarget: "cursor",
      integrationRegistry: registryWith(fakeHost("cursor", "AGENTS.md", { includeAll: true })),
    });

    expect(result.outputs).toEqual([{ targetId: "cursor", path: "AGENTS.md", wrote: true }]);
    expect(read(join(project.cwd, "AGENTS.md"))).toMatch(/Single file/);
    expect(existsSync(join(project.cwd, "src", "AGENTS.md"))).toBe(false);
  });
});
