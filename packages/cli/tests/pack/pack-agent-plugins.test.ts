/**
 * CLI `pack --agent-plugins` — portable tree with declared components.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractPackArchive } from "@b-apm/core";
import {
  createTempProject,
  expectKnownCommand,
  findZipUnder,
  runInProject,
  type TempProject,
  writeText,
} from "./helpers.ts";

const SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";

let project: TempProject | undefined;
let extracted: string | undefined;

afterEach(() => {
  project?.cleanup();
  project = undefined;
  if (extracted) rmSync(extracted, { recursive: true, force: true });
  extracted = undefined;
});

function writePortableTree(cwd: string): void {
  writeText(
    cwd,
    "plugin.json",
    `${JSON.stringify(
      {
        $schema: SCHEMA,
        name: "cli-portable",
        version: "1.0.0",
        commands: ["./commands/ship.md"],
        hooks: ["./hooks/session-start.json"],
        skills: ["hello"],
      },
      null,
      2,
    )}\n`,
  );
  writeText(cwd, "commands/ship.md", "# Ship\n");
  writeText(
    cwd,
    "hooks/session-start.json",
    `${JSON.stringify({ hooks: { sessionStart: [{ command: "./hooks/run.sh" }] } }, null, 2)}\n`,
  );
  writeText(cwd, "hooks/run.sh", "#!/bin/sh\necho hook\n");
  writeText(cwd, "skills/hello/SKILL.md", "---\nname: hello\n---\n# Hello\n");
  writeText(cwd, "skills/hello/guide.md", "# Guide\n");
  writeText(cwd, "agents/reviewer.md", "# Reviewer\n");
  writeText(
    cwd,
    "mcp.json",
    `${JSON.stringify({ mcpServers: { example: { type: "stdio", command: "node" } } }, null, 2)}\n`,
  );
}

describe("CLI pack --agent-plugins", () => {
  test("packs declared components and sibling assets", async () => {
    project = createTempProject("bapm-cli-ap-pack-");
    writePortableTree(project.cwd);

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--agent-plugins",
      "--archive",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);

    const zip = findZipUnder(project.cwd);
    expect(zip).toBeTruthy();
    extracted = join(tmpdir(), `bapm-cli-ap-extract-${Date.now()}`);
    mkdirSync(extracted, { recursive: true });
    await extractPackArchive({ archivePath: zip!, outputDir: extracted! });

    expect(readFileSync(join(extracted, "commands/ship.md"), "utf8")).toBe("# Ship\n");
    expect(readFileSync(join(extracted, "hooks/run.sh"), "utf8")).toBe("#!/bin/sh\necho hook\n");
    expect(readFileSync(join(extracted, "skills/hello/guide.md"), "utf8")).toBe("# Guide\n");
    expect(existsSync(join(extracted, "agents/reviewer.md"))).toBe(true);
    expect(existsSync(join(extracted, "mcp.json"))).toBe(true);
  });

  test("missing declared path exits non-zero without a zip", async () => {
    project = createTempProject("bapm-cli-ap-missing-");
    writeFileSync(
      join(project.cwd, "plugin.json"),
      JSON.stringify({
        $schema: SCHEMA,
        name: "cli-missing",
        version: "1.0.0",
        hooks: ["./hooks/absent.json"],
      }),
      "utf8",
    );

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--agent-plugins",
      "--archive",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/absent|missing|hooks|declared/i);
    expect(findZipUnder(project.cwd)).toBeUndefined();
  });
});
