/**
 * Docs / README: CLI and host integration are separate installs; no “built-in Cursor”.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  existsSync,
  join,
  readRepoText,
  REPO_ROOT,
  runInProject,
  type TempProject,
} from "./helpers.ts";

const BUILTIN_CURSOR_CLAIM =
  /уже встроен|из коробки|built-in|встроен в CLI|ships? (?:with|inside) (?:the )?CLI|already (?:in|inside) (?:the )?CLI/i;

describe("opt-in-host-integrations · docs and README", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("root README does not claim Cursor is built into the CLI", () => {
    const readme = readRepoText("README.md");
    expect(readme).not.toMatch(/Уже встроен в CLI/i);
    expect(readme).not.toMatch(/Из коробки runtime\s*[—–-]\s*\*?\*?Cursor/i);
    expect(readme).toMatch(/@bapm\/integration-cursor/);
    expect(readme).toMatch(/targets:/);
    expect(readme).toMatch(/npm i -g @bapm\/cli/);
  });

  test("supported-hosts guide does not list Cursor as built-in / из коробки", () => {
    const path = "apps/docs/guide/supported-hosts.md";
    expect(existsSync(join(REPO_ROOT, path))).toBe(true);
    const page = readRepoText(path);
    expect(page).not.toMatch(/Cursor \(из коробки\)/i);
    expect(page).not.toMatch(/встроен в CLI/i);
    expect(page).not.toMatch(/\|\s*\*\*Cursor\*\*\s*\|\s*Да\b/);
    expect(page).toMatch(/targets:/);
    expect(page).toMatch(/@bapm\/integration-cursor/);
  });

  test("architecture overview does not call Cursor a CLI built-in runtime", () => {
    const arch = readRepoText("apps/docs/architecture/index.md");
    expect(arch).not.toMatch(/built-in runtime \(Cursor\)/i);
    expect(arch).not.toMatch(/Built-in runtime\s*[—–-]\s*\*?\*?Cursor/i);
    expect(arch).toMatch(/@bapm\/integration-cursor|opt-in|object-map|targets:/i);
  });

  test("install/compile help must not claim built-in Cursor", async () => {
    project = createTempProject();
    const install = await runInProject(project.cwd, ["install", "--help"]);
    const compile = await runInProject(project.cwd, ["compile", "--help"]);
    const text = `${install.combined}\n${compile.combined}`;
    expect(text).not.toMatch(BUILTIN_CURSOR_CLAIM);
    expect(text).toMatch(/--target\s+<id>/i);
  });
});
