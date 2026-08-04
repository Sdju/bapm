/**
 * CLI M7 — install from pack zip round-trip + help wiring (C §17, 19).
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadManifest } from "@bapm/core";
import {
  createTempProject,
  expectKnownCommand,
  findZipUnder,
  runCli,
  runInProject,
  withCapturedIo,
  writeConformingManifest,
  type TempProject,
} from "./helpers.ts";

describe("CLI install-from-archive round-trip", () => {
  let source: TempProject;
  let dest: TempProject;

  afterEach(() => {
    source?.cleanup();
    dest?.cleanup();
  });

  test("§17 pack zip → install <archive> lands parseable manifest", async () => {
    source = createTempProject("bapm-m7-cli-src-");
    dest = createTempProject("bapm-m7-cli-dst-");
    writeConformingManifest(source.cwd, { name: "zip-rt", version: "4.5.6" });

    const pack = await runInProject(source.cwd, ["pack", "--archive"]);
    expectKnownCommand(pack.combined, "pack");
    expect(pack.result).toBe(0);
    const zip = findZipUnder(source.cwd);
    expect(zip).toBeTruthy();

    const install = await runInProject(dest.cwd, ["install", zip!]);
    expectKnownCommand(install.combined, "install");
    expect(install.result).toBe(0);

    expect(
      existsSync(join(dest.cwd, "bapm.yml")) || existsSync(join(dest.cwd, "apm.yml")),
    ).toBe(true);
    const { document: doc } = loadManifest({ cwd: dest.cwd });
    expect(doc.name).toBe("zip-rt");
    expect(doc.version).toBe("4.5.6");
  });

  test("corrupt / non-pack path fails closed", async () => {
    dest = createTempProject("bapm-m7-cli-bad-");
    const bogus = join(dest.cwd, "not-a-pack.zip");
    writeFileSync(bogus, "not-a-zip", "utf8");

    const { result, combined } = await runInProject(dest.cwd, ["install", bogus]);
    expectKnownCommand(combined, "install");
    expect(result).not.toBe(0);
  });
});

describe("CLI help / wiring for producer surface", () => {
  test("§19 help lists init and pack", async () => {
    const { result, stdout } = await withCapturedIo(() => runCli(["help"]));
    const text = stdout.join("\n");
    expect(result).toBe(0);
    expect(text).toMatch(/\binit\b/i);
    expect(text).toMatch(/\bpack\b/i);
  });

  test("install help mentions archive / zip path", async () => {
    const viaInstall = await withCapturedIo(() => runCli(["install", "--help"]));
    const viaHelp = await withCapturedIo(() => runCli(["help", "install"]));
    const text = [...viaInstall.stdout, ...viaHelp.stdout].join("\n");
    expect(viaInstall.result === 0 || viaHelp.result === 0).toBe(true);
    expect(text).toMatch(/archive|\.zip|pack/i);
  });
});
