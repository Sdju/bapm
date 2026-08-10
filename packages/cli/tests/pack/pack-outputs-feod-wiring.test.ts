/**
 * cli-feod-architecture — Pack module owns marketplace flags; no marketplace build verb.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  runInProject,
  type TempProject,
} from "./pack-outputs-helpers.ts";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(cliRoot, "src");

function readSrc(rel: string): string {
  return readFileSync(join(srcRoot, rel), "utf8");
}

describe("mp-pack-outputs CLI FEOD Pack marketplace wiring", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("Pack remains a directory module with index public entry", () => {
    const modDir = join(srcRoot, "modules", "Pack");
    expect(existsSync(modDir)).toBe(true);
    expect(statSync(modDir).isDirectory()).toBe(true);
    expect(existsSync(join(modDir, "index.ts"))).toBe(true);
  });

  test("thin commands/pack.ts does not import @b-apm/core directly", () => {
    const body = readSrc("commands/pack.ts");
    expect(body).not.toMatch(/from\s+["']@b-apm\/core["']/);
    expect(body.length).toBeLessThan(4000);
  });

  test("Pack module sources mention marketplace flag orchestration", () => {
    const packDir = join(srcRoot, "modules", "Pack");
    const files = readdirSync(packDir, { recursive: true })
      .map(String)
      .filter((f) => f.endsWith(".ts"));
    const bodies = files.map((f) => readFileSync(join(packDir, f), "utf8")).join("\n");
    expect(bodies).toMatch(/--marketplace|marketplacePath|marketplace/);
  });

  test("no new top-level Build command module for host JSON emit", () => {
    const modules = readdirSync(join(srcRoot, "modules"));
    expect(modules.filter((n) => /^Build$/i.test(n))).toEqual([]);
    expect(existsSync(join(srcRoot, "commands", "build.ts"))).toBe(false);
  });

  test("marketplace build remains unregistered", async () => {
    project = createTempProject();
    const { result, combined } = await runInProject(project.cwd, ["marketplace", "build"]);
    expectKnownCommand(combined, "marketplace");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/unknown|invalid|unrecognized|not supported/i);
  });

  test("app/init/pack + commands import Pack public entry only", () => {
    const cmd = readSrc("commands/pack.ts");
    const init = readSrc("app/init/pack.ts");
    expect(cmd + "\n" + init).toMatch(/@\/modules\/Pack/);
    expect(cmd).not.toMatch(/@\/modules\/Pack\//);
    expect(init).not.toMatch(/@\/modules\/Pack\//);
  });
});
