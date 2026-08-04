/**
 * Optional bapm-target-cursor e2e skills materialize via install.
 * Package identity / unit materialize live in packages/target-cursor/tests/.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createFakePorts,
  createTempProject,
  getCreateRegistry,
  getRegisterTarget,
  getRunInstall,
  importTargetApi,
  importTargetCursor,
  listFilesRecursive,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("bapm-target-cursor install e2e", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("cursor e2e — skill under registered root (.agents/skills/... or documented)", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    mkdirSync(join(project.cwd, "skill-dep"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: cursor-e2e\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./skill-dep\n`,
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "skill-dep", "apm.yml"),
      `name: skill-dep\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(
      join(project.cwd, "skill-dep", ".apm", "skills", "hello", "SKILL.md"),
      "---\nname: hello\n---\n# Hello\n",
    );
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const api = await importTargetApi();
    const cursorPkg = await importTargetCursor();
    const createCursor =
      cursorPkg.createCursorTarget ?? cursorPkg.createTarget ?? cursorPkg.default;
    expect(typeof createCursor).toBe("function");

    const registry = getCreateRegistry(api)();
    const register = getRegisterTarget(api, registry);
    const cursorTarget = typeof createCursor === "function" ? createCursor() : createCursor;
    register(cursorTarget);

    const runInstall = getRunInstall();
    await runInstall({
      cwd: project.cwd,
      frozen: false,
      targetRegistry: registry,
      registry,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const tg003 = join(project.cwd, ".agents", "skills", "hello", "SKILL.md");
    const agentsSkills = existsSync(join(project.cwd, ".agents", "skills"))
      ? listFilesRecursive(join(project.cwd, ".agents", "skills"))
      : [];
    const cursorFiles = existsSync(join(project.cwd, ".cursor"))
      ? listFilesRecursive(join(project.cwd, ".cursor"))
      : [];

    const deployed =
      existsSync(tg003) ||
      agentsSkills.some((f) => /hello|SKILL\.md/i.test(f)) ||
      cursorFiles.some((f) => /hello|SKILL\.md/i.test(f));
    expect(deployed).toBe(true);

    // Must not escape registered roots — no skill dump at project root
    expect(existsSync(join(project.cwd, "hello", "SKILL.md"))).toBe(false);
  });
});
