import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { mergeHookDeployment, readHookOwnershipSidecar } from "../src/index.ts";
import type { AttributedPrimitive } from "../src/index.ts";

function setupHook(source: unknown): {
  cwd: string;
  primitive: AttributedPrimitive;
} {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-hook-deploy-"));
  mkdirSync(join(cwd, "hooks"), { recursive: true });
  writeFileSync(join(cwd, "hooks", "hook.json"), JSON.stringify(source));
  writeFileSync(join(cwd, "hooks", "run.sh"), "#!/bin/sh\n");
  return {
    cwd,
    primitive: {
      name: "my-hook",
      type: "hook",
      source: "local",
      path: join(cwd, "hooks", "hook.json"),
    },
  };
}

function common(cwd: string) {
  return {
    cwd,
    deployRoots: [".host"],
    docPath: join(cwd, ".host", "hooks.json"),
    ownershipPath: join(cwd, ".host", "bapm-hooks.json"),
    docRel: ".host/hooks.json",
    ownershipRel: ".host/bapm-hooks.json",
    code: "TEST",
    alreadyDeployedNeedle: ".host/",
    commandAsDotSlash: true,
    scriptDestRel: ({ name, command }: { name: string; command: string }) =>
      `.host/hooks/${name}/${basename(command)}`,
  };
}

describe("mergeHookDeployment", () => {
  test("flat mode rewrites commands, writes sidecar, and reports inventory", () => {
    const { cwd, primitive } = setupHook({
      version: 2,
      hooks: { Stop: [{ command: "./run.sh", _apm_source: "drop" }] },
    });
    const result = mergeHookDeployment({
      ...common(cwd),
      hooks: [primitive],
      mode: "flat",
      versionDefault: 1,
    });

    expect(result.document).toMatchObject({
      version: 2,
      hooks: { Stop: [{ command: "./.host/hooks/my-hook/run.sh" }] },
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.deployedFiles.map((file) => file.path)).toEqual([
      ".host/hooks/my-hook/run.sh",
      ".host/hooks.json",
      ".host/bapm-hooks.json",
    ]);
    expect(
      readHookOwnershipSidecar(join(cwd, ".host", "bapm-hooks.json")).owned["my-hook"],
    ).toEqual({
      entries: [{ event: "Stop", command: "./.host/hooks/my-hook/run.sh" }],
      scripts: [".host/hooks/my-hook/run.sh"],
    });
    expect(JSON.parse(readFileSync(join(cwd, ".host", "hooks.json"), "utf8"))).toMatchObject(
      result.document,
    );
  });

  test("native-groups mode renders matcher groups and handler type", () => {
    const { cwd, primitive } = setupHook({
      hooks: { PreToolUse: [{ matcher: "Read", command: "./run.sh" }] },
    });
    const result = mergeHookDeployment({
      ...common(cwd),
      hooks: [primitive],
      mode: "native-groups",
      defaultMatcher: "*",
      defaultHandlerType: true,
    });

    expect(result.document.hooks).toEqual({
      PreToolUse: [
        {
          matcher: "Read",
          hooks: [{ command: "./.host/hooks/my-hook/run.sh", type: "command" }],
        },
      ],
    });
  });

  test("re-running prunes previously owned entries and keeps foreign ones", () => {
    const { cwd, primitive } = setupHook({ hooks: { Stop: [{ command: "./run.sh" }] } });
    mkdirSync(join(cwd, ".host"), { recursive: true });
    writeFileSync(
      join(cwd, ".host", "hooks.json"),
      JSON.stringify({ hooks: { Stop: [{ command: "foreign" }] } }),
    );

    mergeHookDeployment({ ...common(cwd), hooks: [primitive], mode: "flat" });
    const second = mergeHookDeployment({
      ...common(cwd),
      hooks: [primitive],
      mode: "flat",
    });

    expect(second.document.hooks).toEqual({
      Stop: [{ command: "foreign" }, { command: "./.host/hooks/my-hook/run.sh" }],
    });
  });

  test("reports missing and malformed sources without throwing", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-hook-deploy-"));
    const missing = mergeHookDeployment({
      ...common(cwd),
      hooks: [{ name: "missing", type: "hook", source: "local", path: join(cwd, "nope.json") }],
      mode: "flat",
    });
    expect(missing.diagnostics[0]?.code).toBe("TEST_HOOK_SOURCE_MISSING");

    mkdirSync(join(cwd, "hooks"));
    writeFileSync(join(cwd, "hooks", "bad.json"), "{ nope");
    const malformed = mergeHookDeployment({
      ...common(cwd),
      hooks: [{ name: "bad", type: "hook", source: "local", path: join(cwd, "hooks", "bad.json") }],
      mode: "flat",
    });
    expect(malformed.diagnostics[0]?.code).toBe("TEST_HOOK_JSON_INVALID");
  });
});
