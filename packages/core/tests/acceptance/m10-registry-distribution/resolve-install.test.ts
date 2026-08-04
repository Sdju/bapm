/**
 * M10 MUST: registry resolve/install — lk-013 before extract, rs-009 mirror-by-hash,
 * lock resolved_url/resolved_hash, no silent git fallback.
 * Specs: registry-resolve-install. Checklist C §1–4,6–7.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildFlatPackageZip,
  createTempProject,
  expectRejectsMatching,
  getResolveAndLock,
  getRunInstall,
  hasModulesContent,
  listModulesFiles,
  modulesDir,
  readLockText,
  registryManifest,
  sha256Digest,
  sha256Hex,
  startMockRegistry,
  withExperimentalRegistries,
  writeLock,
  writeManifest,
  type MockRegistry,
  type TempProject,
} from "./helpers.ts";

describe("M10 registry resolve + install (mock HTTP)", () => {
  let project: TempProject | undefined;
  let registry: MockRegistry | undefined;
  let mirror: MockRegistry | undefined;

  afterEach(async () => {
    project?.cleanup();
    project = undefined;
    await registry?.close();
    registry = undefined;
    await mirror?.close();
    mirror = undefined;
  });

  test("list+download happy — modules populated; lock has matching resolved_hash", async () => {
    const bytes = buildFlatPackageZip({ name: "contoso/demo", version: "1.1.0" });
    const digest = sha256Digest(bytes);
    registry = await startMockRegistry({
      packages: [
        {
          owner: "contoso",
          repo: "demo",
          versions: [
            {
              version: "1.0.0",
              bytes: buildFlatPackageZip({ name: "contoso/demo", version: "1.0.0" }),
            },
            { version: "1.1.0", bytes, digest },
          ],
        },
      ],
    });

    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      registryManifest({
        registryUrl: registry.baseUrl,
        depId: "contoso/demo",
        depVersion: "^1.0.0",
        useDefault: true,
      }),
    );

    await withExperimentalRegistries(async () => {
      const result = await getResolveAndLock()({
        cwd: project!.cwd,
        registryBaseUrl: registry!.baseUrl,
      });
      expect(result === undefined || typeof result === "object").toBe(true);
    });

    expect(hasModulesContent(project.cwd)).toBe(true);
    const lockText = readLockText(project.cwd);
    expect(lockText).toMatch(/source:\s*registry/);
    expect(lockText).toMatch(/resolved_url:/);
    expect(lockText).toMatch(new RegExp(`resolved_hash:\\s*["']?${digest.replace(":", "\\:")}`));
    expect(lockText).toMatch(/lockfile_version:\s*["']?2["']?/);
  });

  test("lk-013 digest mismatch fails before extract; modules unchanged", async () => {
    const bytes = buildFlatPackageZip({ name: "contoso/demo", version: "1.0.0" });
    const wrongDigest = `sha256:${"ab".repeat(32)}`;
    expect(wrongDigest).not.toBe(sha256Digest(bytes));

    registry = await startMockRegistry({
      packages: [
        {
          owner: "contoso",
          repo: "demo",
          versions: [{ version: "1.0.0", bytes, digest: wrongDigest }],
        },
      ],
    });

    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      registryManifest({
        registryUrl: registry.baseUrl,
        depId: "contoso/demo",
        depVersion: "1.0.0",
      }),
    );

    const before = listModulesFiles(project.cwd);

    await withExperimentalRegistries(async () => {
      await expectRejectsMatching(
        () =>
          getResolveAndLock()({
            cwd: project!.cwd,
            registryBaseUrl: registry!.baseUrl,
          }),
        /digest|hash|lk-013|mismatch|integrity|sha256/i,
      );
    });

    expect(listModulesFiles(project.cwd)).toEqual(before);
    // Must not leave a successful package tree for the registry id
    const modules = modulesDir(project.cwd);
    if (existsSync(modules)) {
      const joined = listModulesFiles(project.cwd).join("\n");
      expect(joined).not.toMatch(/contoso\/demo|\.apm\/keep\.txt/);
    }
  });

  test("rs-009 mirror URL with matching hash succeeds", async () => {
    const bytes = buildFlatPackageZip({ name: "contoso/demo", version: "2.3.1" });
    const digest = sha256Digest(bytes);

    registry = await startMockRegistry({
      packages: [
        {
          owner: "contoso",
          repo: "demo",
          versions: [{ version: "2.3.1", bytes, digest }],
        },
      ],
    });
    mirror = await startMockRegistry({
      packages: [
        {
          owner: "contoso",
          repo: "demo",
          versions: [{ version: "2.3.1", bytes, digest }],
        },
      ],
    });

    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      registryManifest({
        registryUrl: mirror.baseUrl,
        depId: "contoso/demo",
        depVersion: "2.3.1",
      }),
    );

    const originalUrl = `${registry.baseUrl}/v1/packages/contoso/demo/versions/2.3.1/download`;
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "2"
dependencies:
  - repo_url: registry.example.com/contoso/demo
    name: contoso/demo
    source: registry
    resolved_url: ${originalUrl}
    resolved_hash: "${digest}"
    version: "2.3.1"
    depth: 1
`,
    );

    await withExperimentalRegistries(async () => {
      const result = await getRunInstall()({
        cwd: project!.cwd,
        frozen: true,
        registryBaseUrl: mirror!.baseUrl,
        mirrorUrl: mirror!.baseUrl,
      });
      expect(result === undefined || typeof result === "object").toBe(true);
    });

    expect(hasModulesContent(project.cwd)).toBe(true);
    // Mirror was hit (or install succeeded verifying hash from alternate base)
    const lockText = readLockText(project.cwd);
    expect(lockText).toContain(digest);
    expect(sha256Hex(bytes)).toBe(digest.slice("sha256:".length));
  });

  test("unreachable registry does not fall back to git clone", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      registryManifest({
        registryUrl: "http://127.0.0.1:9",
        depId: "contoso/demo",
        depVersion: "1.0.0",
      }),
    );

    const gitCalls: string[] = [];
    await withExperimentalRegistries(async () => {
      await expectRejectsMatching(
        () =>
          getResolveAndLock()({
            cwd: project!.cwd,
            gitRemote: {
              async resolveRef(repoUrl: string) {
                gitCalls.push(repoUrl);
                throw new Error("git should not be called");
              },
            },
            downloader: {
              async download(args: { repoUrl?: string }) {
                if (args.repoUrl) gitCalls.push(args.repoUrl);
                throw new Error("git download should not be called");
              },
            },
          }),
        /registry|fetch|ECONNREFUSED|network|unreachable|http/i,
      );
    });

    expect(gitCalls).toEqual([]);
  });

  test("registries.default used when per-dep registry name omitted", async () => {
    const bytes = buildFlatPackageZip({ name: "acme/pkg", version: "1.0.0" });
    registry = await startMockRegistry({
      packages: [
        { owner: "acme", repo: "pkg", versions: [{ version: "1.0.0", bytes }] },
      ],
    });

    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      registryManifest({
        name: "default-route",
        registryUrl: registry.baseUrl,
        depId: "acme/pkg",
        depVersion: "1.0.0",
        useDefault: true,
      }),
    );

    await withExperimentalRegistries(async () => {
      await getResolveAndLock()({ cwd: project!.cwd });
    });

    expect(registry.requests.some((r) => /\/v1\/packages\/acme\/pkg\//.test(r.url))).toBe(true);
    expect(hasModulesContent(project.cwd)).toBe(true);
  });

  test("named registry routes to correct base URL", async () => {
    const bytes = buildFlatPackageZip({ name: "acme/pkg", version: "1.0.0" });
    registry = await startMockRegistry({
      packages: [
        { owner: "acme", repo: "pkg", versions: [{ version: "1.0.0", bytes }] },
      ],
    });
    const other = await startMockRegistry({ packages: [] });
    mirror = other;

    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: named-route
version: 0.0.1
registries:
  primary:
    url: ${registry.baseUrl}
  other:
    url: ${other.baseUrl}
  default: other
dependencies:
  apm:
    - id: acme/pkg
      version: "1.0.0"
      registry: primary
`,
    );

    await withExperimentalRegistries(async () => {
      await getResolveAndLock()({ cwd: project!.cwd });
    });

    expect(registry.requests.length).toBeGreaterThan(0);
    expect(other.requests.filter((r) => /\/v1\/packages\//.test(r.url))).toHaveLength(0);
  });

  test("marketplace kind remains deferred / fail-closed (not registry install)", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: mkt-root
version: 0.0.1
dependencies:
  apm:
    - marketplace: some-plugin
`,
    );

    await withExperimentalRegistries(async () => {
      await expectRejectsMatching(
        () => getResolveAndLock()({ cwd: project!.cwd }),
        /marketplace|deferred|unsupported|unknown source/i,
      );
    });
    expect(hasModulesContent(project.cwd)).toBe(false);
  });
});
