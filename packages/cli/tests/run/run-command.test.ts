/**
 * `bapm run` / `bapm preview` — manifest scripts, parameters, and safe quoting.
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { runInProject, writeText } from "../integrations/map-load-helpers.ts";

type Project = { cwd: string; home: string; cleanup: () => void };

function createProject(scripts: Record<string, string>): Project {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-run-cli-"));
  const home = mkdtempSync(join(tmpdir(), "bapm-run-home-"));
  const lines = Object.entries(scripts).map(
    ([name, command]) => `  ${name}: ${JSON.stringify(command)}`,
  );
  writeText(
    cwd,
    "bapm.yml",
    `name: run-fixture\nversion: 0.0.1\ndependencies:\n  apm: []\nscripts:\n${lines.join("\n")}\n`,
  );
  return {
    cwd,
    home,
    cleanup: () => {
      rmSync(cwd, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    },
  };
}

describe("CLI run / preview", () => {
  let project: Project | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("run without a name executes the default start script", async () => {
    project = createProject({ start: "echo start-default" });
    const { result, stdout } = await runInProject(project.cwd, ["run"], { HOME: project.home });

    expect(result).toBe(0);
    expect(stdout.join("\n")).toContain("start-default");
  });

  test("run executes a named script", async () => {
    project = createProject({ start: "echo start", hello: "echo named-script" });
    const { result, stdout } = await runInProject(project.cwd, ["run", "hello"], {
      HOME: project.home,
    });

    expect(result).toBe(0);
    expect(stdout.join("\n")).toContain("named-script");
    expect(stdout.join("\n")).not.toContain("start");
  });

  test("parameters substitute in the command and are exported as PARAM_*", async () => {
    project = createProject({
      greet: "echo hello {{name}}",
      input: "echo input-${input:name}",
      env: "echo env-$PARAM_NAME",
    });

    const brace = await runInProject(project.cwd, ["run", "greet", "-p", "name=World"], {
      HOME: project.home,
    });
    expect(brace.result).toBe(0);
    expect(brace.stdout.join("\n")).toContain("hello World");

    const dollar = await runInProject(project.cwd, ["run", "input", "--param", "name=World"], {
      HOME: project.home,
    });
    expect(dollar.result).toBe(0);
    expect(dollar.stdout.join("\n")).toContain("input-World");

    const env = await runInProject(project.cwd, ["run", "env", "-p", "name=FromEnv"], {
      HOME: project.home,
    });
    expect(env.result).toBe(0);
    expect(env.stdout.join("\n")).toContain("env-FromEnv");
  });

  test("preview prints the resolved command and never executes it", async () => {
    project = createProject({ start: "touch preview-marker.txt && echo {{name}}" });
    const { result, stdout } = await runInProject(project.cwd, ["preview", "-p", "name=World"], {
      HOME: project.home,
    });

    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, "preview-marker.txt"))).toBe(false);
    const text = stdout.join("\n");
    expect(text).toContain("script: start");
    expect(text).toContain("original: touch preview-marker.txt && echo {{name}}");
    expect(text).toContain("resolved: touch preview-marker.txt && echo 'World'");
    expect(text).toContain("parameters: name=World");
  });

  test("run --dry-run prints the command without executing it", async () => {
    project = createProject({ start: "touch dry-run-marker.txt" });
    const { result, stdout } = await runInProject(project.cwd, ["run", "--dry-run"], {
      HOME: project.home,
    });

    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, "dry-run-marker.txt"))).toBe(false);
    expect(stdout.join("\n")).toContain("dry-run: command not executed");
  });

  test("missing named script lists available scripts and exits non-zero", async () => {
    project = createProject({ start: "echo hi", test: "echo test" });
    const { result, stdout, stderr } = await runInProject(project.cwd, ["run", "nope"], {
      HOME: project.home,
    });

    expect(result).toBe(1);
    const text = [...stdout, ...stderr].join("\n");
    expect(text).toContain('script "nope" not found');
    expect(text).toContain("Available scripts:");
    expect(text).toContain("start");
    expect(text).toContain("test");
  });

  test("no start script and no name exits non-zero with available scripts", async () => {
    project = createProject({ hello: "echo hello" });
    const { result, stdout, stderr } = await runInProject(project.cwd, ["run"], {
      HOME: project.home,
    });

    expect(result).toBe(1);
    const text = [...stdout, ...stderr].join("\n");
    expect(text).toMatch(/no script specified/i);
    expect(text).toContain("hello");
  });

  test("command failure propagates a non-zero exit", async () => {
    project = createProject({ fail: "exit 3" });
    const { result, stderr } = await runInProject(project.cwd, ["run", "fail"], {
      HOME: project.home,
    });

    expect(result).toBe(3);
    expect(stderr.join("\n")).toContain('script "fail" failed with exit code 3');
  });

  test("parameter values are shell-quoted and cannot inject commands", async () => {
    project = createProject({ inject: "echo {{value}}" });
    const attack = "; touch PWNED-$(touch PWNED2)";
    const { result, stdout } = await runInProject(
      project.cwd,
      ["run", "inject", "-p", `value=${attack}`],
      { HOME: project.home },
    );

    expect(result).toBe(0);
    expect(stdout.join("\n")).toContain(attack);
    expect(existsSync(join(project.cwd, "PWNED"))).toBe(false);
    expect(existsSync(join(project.cwd, "PWNED2"))).toBe(false);
  });

  test("parameter values with single quotes round-trip safely", async () => {
    project = createProject({ quoted: "echo {{value}}" });
    const { result, stdout } = await runInProject(
      project.cwd,
      ["run", "quoted", "-p", "value=a'b"],
      { HOME: project.home },
    );

    expect(result).toBe(0);
    expect(stdout.join("\n")).toContain("a'b");
  });

  test("unknown flags and malformed parameters fail closed", async () => {
    project = createProject({ start: "echo hi" });
    const unknown = await runInProject(project.cwd, ["run", "--not-a-real-flag"], {
      HOME: project.home,
    });
    expect(unknown.result).toBe(1);
    expect(unknown.stderr.join("\n")).toContain("--not-a-real-flag");

    const malformed = await runInProject(project.cwd, ["run", "-p", "no-equals"], {
      HOME: project.home,
    });
    expect(malformed.result).toBe(1);
    expect(malformed.stderr.join("\n")).toContain("expected name=value");
  });

  test("help lists run and preview", async () => {
    project = createProject({ start: "echo hi" });
    const top = await runInProject(project.cwd, ["help"], { HOME: project.home });
    expect(top.result).toBe(0);
    expect(top.stdout.join("\n")).toMatch(/\brun\b/);
    expect(top.stdout.join("\n")).toMatch(/\bpreview\b/);

    const topic = await runInProject(project.cwd, ["help", "run"], { HOME: project.home });
    expect(topic.result).toBe(0);
    expect(topic.stdout.join("\n")).toContain("Usage:");
  });
});
