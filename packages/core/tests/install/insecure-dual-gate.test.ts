/**
 * Dual-consent HTTP + transitive --allow-insecure-host (install-pipeline).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createFakePorts,
  createTempProject,
  expectRejectsMatching,
  getRunInstall,
  writeDirectHttpProject,
  writeTransitiveHttpProject,
  type TempProject,
} from "./ux-helpers.ts";

describe("install insecure dual-gate + host allowlist", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("HTTP direct with manifest allow_insecure blocked without CLI flag", async () => {
    project = createTempProject();
    const url = writeDirectHttpProject(project.cwd, { allowInsecure: true });
    const ports = createFakePorts({ commitsByRef: { main: "a".repeat(40) } });
    const runInstall = getRunInstall();

    const err = await expectRejectsMatching(
      () =>
        runInstall({
          cwd: project!.cwd,
          frozen: false,
          allowInsecure: false,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /allow-insecure|HTTP|insecure/i,
    );

    expect(ports.downloadCalls.some((c) => c.repo.includes("mirror.example.com"))).toBe(
      false,
    );
    // APM-shaped remediation asks for the CLI flag when manifest already allows.
    const msg = err instanceof Error ? err.message : String(err);
    expect(msg).toMatch(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    expect(msg).toMatch(/--allow-insecure/);
    expect(msg).not.toMatch(/Set allow_insecure:\s*true/i);
  });

  test("HTTP direct blocked without manifest allow_insecure (even with CLI flag)", async () => {
    project = createTempProject();
    const url = writeDirectHttpProject(project.cwd, { allowInsecure: false });
    const ports = createFakePorts({ commitsByRef: { main: "b".repeat(40) } });
    const runInstall = getRunInstall();

    const err = await expectRejectsMatching(
      () =>
        runInstall({
          cwd: project!.cwd,
          frozen: false,
          allowInsecure: true,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /allow_insecure|HTTP|insecure/i,
    );

    expect(ports.downloadCalls.length).toBe(0);
    const msg = err instanceof Error ? err.message : String(err);
    expect(msg).toMatch(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    expect(msg).toMatch(/allow_insecure:\s*true/i);
  });

  test("dual consent allows HTTP direct (gate does not block; warn may emit)", async () => {
    project = createTempProject();
    writeDirectHttpProject(project.cwd, { allowInsecure: true });
    const ports = createFakePorts({ commitsByRef: { main: "c".repeat(40) } });
    const runInstall = getRunInstall();

    const result = await runInstall({
      cwd: project.cwd,
      frozen: false,
      allowInsecure: true,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(result).toMatchObject({ ok: true });
    expect(ports.downloadCalls.some((c) => /mirror\.example\.com|direct-pkg/i.test(c.repo))).toBe(
      true,
    );
    // Allowed path still acknowledges insecure transport (APM warning intent).
    expect(JSON.stringify(result)).toMatch(/Insecure HTTP|unencrypted/i);
  });

  test("transitive HTTP without host allow fails closed", async () => {
    project = createTempProject();
    const { childUrl } = writeTransitiveHttpProject(project.cwd);
    const ports = createFakePorts({ commitsByRef: { main: "d".repeat(40) } });
    const runInstall = getRunInstall();

    const err = await expectRejectsMatching(
      () =>
        runInstall({
          cwd: project!.cwd,
          frozen: false,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /allow-insecure-host|evil\.example\.com|HTTP|insecure|host/i,
    );

    expect(ports.downloadCalls.some((c) => c.repo.includes("evil.example.com"))).toBe(false);
    const msg = err instanceof Error ? err.message : String(err);
    expect(msg).toMatch(/evil\.example\.com/);
    expect(msg).toMatch(/--allow-insecure-host/);
    expect(childUrl).toMatch(/^http:/);
  });

  test("allow-insecure-host permits transitive HTTP host", async () => {
    project = createTempProject();
    writeTransitiveHttpProject(project.cwd, {
      childUrl: "http://mirror.example.com/child.git",
    });
    const ports = createFakePorts({ commitsByRef: { main: "e".repeat(40) } });
    const runInstall = getRunInstall();

    const result = await runInstall({
      cwd: project.cwd,
      frozen: false,
      allowInsecureHosts: ["mirror.example.com"],
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(result).toMatchObject({ ok: true });
    expect(
      ports.downloadCalls.some((c) => /mirror\.example\.com|child/i.test(c.repo)),
    ).toBe(true);
  });

  test("invalid allowInsecureHosts rejected fail-closed before download", async () => {
    project = createTempProject();
    writeDirectHttpProject(project.cwd, { allowInsecure: true });
    const ports = createFakePorts({ commitsByRef: { main: "f".repeat(40) } });
    const runInstall = getRunInstall();

    await expectRejectsMatching(
      () =>
        runInstall({
          cwd: project!.cwd,
          frozen: false,
          allowInsecure: true,
          allowInsecureHosts: ["not a host"],
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /hostname|host|FQDN|invalid/i,
    );

    expect(ports.downloadCalls.length).toBe(0);
  });
});
