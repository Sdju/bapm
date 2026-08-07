/**
 * G4 — Resolver: remove marketplace fail-closed; resolve then continue graph
 */
import { homedir } from "node:os";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  asRecord,
  createTempConfigDir,
  createTempProject,
  expectAsyncThrowMatching,
  getResolveDependencyGraph,
  lockDepsOf,
  registerLocalMarketplace,
  writeGithubShapedMarketplace,
  writeLocalMarketplaceTree,
  writeManifest,
  writeText,
  type TempConfig,
} from "./search-install-helpers.ts";

async function withHome<T>(home: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.HOME;
  process.env.HOME = home;
  try {
    // Sanity: Node os.homedir() should follow HOME on POSIX
    if (homedir() !== home) {
      // Still proceed — resolve may accept marketplaceConfigDir later
    }
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.HOME;
    else process.env.HOME = prev;
  }
}

describe("mp-search-install G4 resolveGraph marketplace wire", () => {
  let tmp: TempConfig | undefined;
  let project: { cwd: string; cleanup: () => void } | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
    tmp?.cleanup();
    tmp = undefined;
  });

  test("marketplace string dep continues as concrete local and carries provenance on lock nodes", async () => {
    tmp = createTempConfigDir();
    project = createTempProject();
    const { marketplaceRoot } = writeLocalMarketplaceTree(tmp.root, {
      marketplaceName: "local-mp",
      pluginName: "demo",
    });
    // Place registry at HOME/.bapm so graph resolve (no configDir yet) can find it
    registerLocalMarketplace("local-mp", marketplaceRoot, { configDir: tmp.configDir });

    writeManifest(
      project.cwd,
      `name: root\nversion: 0.0.1\ndependencies:\n  apm:\n    - demo@local-mp\n`,
    );

    const resolveGraph = getResolveDependencyGraph();
    const result = await withHome(tmp.root, () =>
      resolveGraph({
        cwd: project!.cwd,
        skipDownload: false,
        marketplaceConfigDir: tmp!.configDir,
        configDir: tmp!.configDir,
      }),
    );

    const bag = asRecord(result);
    const lock = bag.lockfile ?? bag.lock ?? bag.document ?? bag;
    const deps = lockDepsOf({ document: lock });
    const hit = deps.find((d) => {
      const text = JSON.stringify(d).toLowerCase();
      return text.includes("demo") || text.includes("local-mp");
    });
    expect(hit).toBeTruthy();
    expect(String(hit!.discovered_via)).toMatch(/^local-mp$/i);
    expect(String(hit!.marketplace_plugin_name)).toMatch(/^demo$/i);
    // Must not remain deferred fail-closed
    expect(JSON.stringify(result)).not.toMatch(/RESOLVE_REGISTRY_DEFERRED|deferred\/unsupported/i);
  });

  test("marketplace miss does not bare-git fallback to NAME/MARKETPLACE", async () => {
    tmp = createTempConfigDir();
    project = createTempProject();
    writeManifest(
      project.cwd,
      `name: root\nversion: 0.0.1\ndependencies:\n  apm:\n    - missing@no-such-market\n`,
    );

    const resolveGraph = getResolveDependencyGraph();
    await withHome(tmp.root, () =>
      expectAsyncThrowMatching(
        () =>
          resolveGraph({
            cwd: project!.cwd,
            marketplaceConfigDir: tmp!.configDir,
            configDir: tmp!.configDir,
          }),
        /marketplace.*not.?found|plugin.*not.?found|no-such-market|not.?found/i,
      ),
    );
  });

  test("object marketplace form resolves via graph without fail-closed", async () => {
    tmp = createTempConfigDir();
    project = createTempProject();
    const { marketplaceRoot } = writeGithubShapedMarketplace(tmp.root, {
      marketplaceName: "gh-mp",
      pluginName: "tools",
    });
    registerLocalMarketplace("gh-mp", marketplaceRoot, { configDir: tmp.configDir });

    writeManifest(
      project.cwd,
      `name: root\nversion: 0.0.1\ndependencies:\n  apm:\n    - name: tools\n      marketplace: gh-mp\n      version: main\n`,
    );

    const resolveGraph = getResolveDependencyGraph();
    // Fake git ports so github coords do not hit network
    const fakeCommit = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const result = await withHome(tmp.root, () =>
      resolveGraph({
        cwd: project!.cwd,
        marketplaceConfigDir: tmp!.configDir,
        configDir: tmp!.configDir,
        gitRemote: {
          async resolveRef() {
            return fakeCommit;
          },
        },
        downloader: {
          async download(args: { dest: string }) {
            writeText(
              `${args.dest}/apm.yml`,
              "name: tools\nversion: 0.0.1\ndependencies:\n  apm: []\n",
            );
          },
        },
        tagLister: {
          async listTags() {
            return [];
          },
        },
      }),
    );

    const deps = lockDepsOf({
      document: asRecord(result).lockfile ?? asRecord(result).lock ?? result,
    });
    const hit = deps.find((d) => JSON.stringify(d).toLowerCase().includes("tools"));
    expect(hit).toBeTruthy();
    expect(String(hit!.discovered_via)).toMatch(/^gh-mp$/i);
    expect(String(hit!.marketplace_plugin_name)).toMatch(/^tools$/i);
  });
});
