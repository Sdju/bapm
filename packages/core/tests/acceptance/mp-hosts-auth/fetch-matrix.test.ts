/**
 * G2–G4 / G6 / G10 — Fetch unlock: GHE api_base, gitlab REST, ado Items REST,
 * cross-class header refuse, generic git refuse, github.com/url/local regression.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  FIXTURE_MP,
  createTempDir,
  getCreateMarketplaceSource,
  getFetchMarketplace,
  withEnv,
  type TempDir,
  writeText,
  join,
} from "./helpers.ts";

type Captured = { url: string; headers: Record<string, string> };

function headerMap(init?: RequestInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (!init?.headers) return out;
  const h = init.headers;
  if (h instanceof Headers) {
    h.forEach((v, k) => {
      out[k.toLowerCase()] = v;
    });
    return out;
  }
  if (Array.isArray(h)) {
    for (const [k, v] of h) out[String(k).toLowerCase()] = String(v);
    return out;
  }
  for (const [k, v] of Object.entries(h as Record<string, string>)) {
    out[k.toLowerCase()] = String(v);
  }
  return out;
}

describe("mp-hosts-auth fetch matrix", () => {
  let tmp: TempDir | undefined;
  const captured: Captured[] = [];

  afterEach(() => {
    tmp?.cleanup();
    tmp = undefined;
    captured.length = 0;
    for (const k of [
      "GITHUB_TOKEN",
      "GH_TOKEN",
      "GITLAB_TOKEN",
      "GITLAB_APM_PAT",
      "ADO_APM_PAT",
      "GITHUB_HOST",
      "GITLAB_HOST",
    ]) {
      delete process.env[k];
    }
  });

  test("GHE Contents API uses https://{host}/api/v3 (not only api.github.com)", async () => {
    const create = getCreateMarketplaceSource();
    const fetchMp = getFetchMarketplace();
    const source = create({
      name: "ghe-mp",
      url: "https://corp.ghe.com/acme/tools.git",
      path: "marketplace.json",
      ref: "main",
    });

    const transport = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      captured.push({ url, headers: headerMap(init) });
      return new Response(FIXTURE_MP, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    await fetchMp(source, { fetch: transport, forceRefresh: true });
    expect(captured.length).toBeGreaterThan(0);
    const urls = captured.map((c) => c.url).join("\n");
    expect(urls).toMatch(/https:\/\/corp\.ghe\.com\/api\/v3\//i);
    expect(urls).not.toMatch(/https:\/\/api\.github\.com\//i);
  });

  test("GITHUB_HOST GHES uses enterprise api_base", async () => {
    await withEnv({ GITHUB_HOST: "ghe.example.com" }, async () => {
      const create = getCreateMarketplaceSource();
      const fetchMp = getFetchMarketplace();
      const source = create({
        name: "ghes-mp",
        url: "https://ghe.example.com/acme/tools.git",
        path: "marketplace.json",
        ref: "main",
      });
      expect(source.kind).toBe("github");

      const transport = async (input: RequestInfo | URL, init?: RequestInit) => {
        captured.push({ url: String(input), headers: headerMap(init) });
        return new Response(FIXTURE_MP, { status: 200 });
      };

      await fetchMp(source, { fetch: transport, forceRefresh: true });
      const urls = captured.map((c) => c.url).join("\n");
      expect(urls).toMatch(/https:\/\/ghe\.example\.com\/api\/v3\//i);
      expect(urls).not.toMatch(/https:\/\/api\.github\.com\//i);
    });
  });

  test("gitlab REST fetch uses GitLab token class (not GitHub Authorization)", async () => {
    await withEnv(
      {
        GITLAB_TOKEN: "glpat-ACCEPT_GL_ONLY",
        GITHUB_TOKEN: "ghp_MUST_NOT_APPEAR",
        GH_TOKEN: undefined,
      },
      async () => {
        const create = getCreateMarketplaceSource();
        const fetchMp = getFetchMarketplace();
        const source = create({
          name: "gl-mp",
          url: "https://gitlab.com/acme/tools.git",
          path: "marketplace.json",
          ref: "main",
        });
        expect(source.kind).toBe("gitlab");

        const transport = async (input: RequestInfo | URL, init?: RequestInit) => {
          captured.push({ url: String(input), headers: headerMap(init) });
          return new Response(FIXTURE_MP, { status: 200 });
        };

        await fetchMp(source, { fetch: transport, forceRefresh: true });
        expect(captured.length).toBeGreaterThan(0);
        const urls = captured.map((c) => c.url).join("\n");
        expect(urls).toMatch(/\/api\/v4\//i);

        for (const c of captured) {
          const auth = c.headers.authorization ?? "";
          const privateToken = c.headers["private-token"] ?? "";
          expect(auth).not.toMatch(/ghp_MUST_NOT_APPEAR/);
          expect(privateToken).not.toMatch(/ghp_MUST_NOT_APPEAR/);
          const usedGitlab =
            privateToken === "glpat-ACCEPT_GL_ONLY" ||
            auth.includes("glpat-ACCEPT_GL_ONLY") ||
            auth.toLowerCase().startsWith("bearer glpat-");
          expect(usedGitlab, `expected GitLab auth on ${c.url}, headers=${JSON.stringify(c.headers)}`).toBe(
            true,
          );
        }
      },
    );
  });

  test("cross-class: gitlab fetch with only GITHUB_TOKEN omits GitHub Authorization", async () => {
    await withEnv(
      {
        GITHUB_TOKEN: "ghp_CROSS_CLASS_SECRET",
        GH_TOKEN: "ghp_CROSS_CLASS_SECRET",
        GITLAB_TOKEN: undefined,
        GITLAB_APM_PAT: undefined,
      },
      async () => {
        const create = getCreateMarketplaceSource();
        const fetchMp = getFetchMarketplace();
        const source = create({
          name: "gl-x",
          url: "https://gitlab.com/acme/tools.git",
          path: "marketplace.json",
        });

        const transport = async (input: RequestInfo | URL, init?: RequestInit) => {
          captured.push({ url: String(input), headers: headerMap(init) });
          return new Response(FIXTURE_MP, { status: 200 });
        };

        await fetchMp(source, { fetch: transport, forceRefresh: true });
        expect(captured.length).toBeGreaterThan(0);
        for (const c of captured) {
          const blob = JSON.stringify(c.headers);
          expect(blob).not.toMatch(/ghp_CROSS_CLASS_SECRET/);
          expect(c.headers.authorization ?? "").not.toMatch(/Bearer\s+ghp_/i);
        }
      },
    );
  });

  test("ado Items REST fetch (not sparse git) for decomposable URL", async () => {
    await withEnv({ ADO_APM_PAT: "ado_ACCEPT_PAT", GITHUB_TOKEN: undefined }, async () => {
      const create = getCreateMarketplaceSource();
      const fetchMp = getFetchMarketplace();
      const source = create({
        name: "ado-mp",
        url: "https://dev.azure.com/contoso/proj/_git/tools",
        path: "marketplace.json",
        ref: "main",
      });
      expect(source.kind).toBe("ado");

      const transport = async (input: RequestInfo | URL, init?: RequestInit) => {
        captured.push({ url: String(input), headers: headerMap(init) });
        return new Response(FIXTURE_MP, { status: 200 });
      };

      await fetchMp(source, { fetch: transport, forceRefresh: true });
      expect(captured.length).toBeGreaterThan(0);
      const urls = captured.map((c) => c.url).join("\n");
      expect(urls).toMatch(/\/_apis\/git\/repositories\//i);
      expect(urls).toMatch(/items/i);
      expect(urls).not.toMatch(/git-upload-pack|info\/refs/i);
    });
  });

  test("generic git kind refused without network I/O", async () => {
    const create = getCreateMarketplaceSource();
    const fetchMp = getFetchMarketplace();
    const source = create({
      name: "generic",
      url: "https://git.example.invalid/acme/tools.git",
      path: "marketplace.json",
    });
    expect(source.kind).toBe("git");

    let hits = 0;
    await expect(
      fetchMp(source, {
        fetch: async () => {
          hits += 1;
          throw new Error("network must not be called for generic git");
        },
        forceRefresh: true,
      }),
    ).rejects.toThrow(/git|unsupported|not supported|out of scope|refuse/i);
    expect(hits).toBe(0);
  });

  test("github.com Contents API still works (regression)", async () => {
    const create = getCreateMarketplaceSource();
    const fetchMp = getFetchMarketplace();
    const source = create({
      name: "gh-mp",
      url: "https://github.com/acme/tools.git",
      path: "marketplace.json",
      ref: "main",
    });

    const transport = async (input: RequestInfo | URL) => {
      captured.push({ url: String(input), headers: {} });
      return new Response(FIXTURE_MP, { status: 200 });
    };

    const manifest = (await fetchMp(source, {
      fetch: transport,
      forceRefresh: true,
    })) as { plugins?: { name: string }[] };
    expect(captured.some((c) => /api\.github\.com/.test(c.url))).toBe(true);
    expect(manifest.plugins?.some((p) => p.name === "demo-plugin")).toBe(true);
  });

  test("url HTTPS fetch + local auto-detect still work (regression)", async () => {
    tmp = createTempDir();
    const file = join(tmp.path, ".claude-plugin", "marketplace.json");
    writeText(file, FIXTURE_MP);

    const create = getCreateMarketplaceSource();
    const fetchMp = getFetchMarketplace();

    const local = create({ name: "local-mp", url: tmp.path, path: "" });
    const localManifest = (await fetchMp(local, { forceRefresh: true })) as {
      plugins?: { name: string }[];
    };
    expect(localManifest.plugins?.some((p) => p.name === "demo-plugin")).toBe(true);

    let hits = 0;
    const urlSource = create({
      name: "url-mp",
      url: "https://example.com/path/marketplace.json",
      path: "",
    });
    const urlManifest = (await fetchMp(urlSource, {
      configDir: tmp.path,
      forceRefresh: true,
      fetch: async (input: RequestInfo | URL) => {
        hits += 1;
        expect(String(input)).toBe("https://example.com/path/marketplace.json");
        return new Response(FIXTURE_MP, { status: 200 });
      },
    })) as { plugins?: { name: string }[] };
    expect(hits).toBe(1);
    expect(urlManifest.plugins?.some((p) => p.name === "demo-plugin")).toBe(true);
  });
});
