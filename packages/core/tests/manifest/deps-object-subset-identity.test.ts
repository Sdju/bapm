/**
 * Registry object-form identity on serialize / structured rewrite (req-mf-024).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { loadYamlDocument, parseManifest, serializeManifest, type BapmManifest } from "@b-apm/core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  DEMO_ID,
  apmObjectEntries,
  baseManifest,
  createFakePorts,
  createTempProject,
  expectThrowsMatching,
  getMergeApmDependencyUpdate,
  getRunInstall,
  readProjectManifest,
  stringList,
  writeManifestYaml,
  type TempProject,
} from "./deps-subset-helpers.ts";

function roundTrip(document: BapmManifest): {
  yaml: string;
  parsed: BapmManifest;
  raw: unknown;
} {
  const yaml = serializeManifest(document);
  const raw = loadYamlDocument(yaml);
  const parsed = parseManifest(raw);
  return { yaml, parsed, raw };
}

describe("serialize preserves registry object-form (req-mf-024)", () => {
  test("registry entry with skills round-trips as id object, not git", () => {
    const document = parseManifest(
      baseManifest({
        dependencies: {
          apm: [{ id: "acme/toolkit", version: "1.0.0", skills: ["alpha"] }],
        },
      }),
    );
    const { yaml, parsed } = roundTrip(document);
    expect(yaml).toMatch(/id:\s*acme\/toolkit/);
    expect(yaml).not.toMatch(/(^|\n)\s*git:/);
    expect(yaml).not.toMatch(/https:\/\/github\.com\/acme\/toolkit/);
    const [entry] = apmObjectEntries(parsed);
    expect(entry?.id).toBe("acme/toolkit");
    expect(entry).not.toHaveProperty("git");
    expect(stringList(entry?.skills)).toEqual(["alpha"]);
  });

  test("registry entry without skills still serializes as object with id", () => {
    const document = parseManifest(
      baseManifest({
        registries: { primary: { url: "https://registry.example" } },
        dependencies: {
          apm: [{ id: "acme/toolkit", registry: "primary", version: "1.0.0" }],
        },
      }),
    );
    const { yaml, parsed } = roundTrip(document);
    expect(yaml).toMatch(/id:\s*acme\/toolkit/);
    expect(yaml).toMatch(/registry:\s*primary/);
    expect(yaml).toMatch(/version:\s*["']?1\.0\.0/);
    expect(yaml).not.toMatch(/(^|\n)\s*-\s+acme\/toolkit\s*$/m);
    const [entry] = apmObjectEntries(parsed);
    expect(entry?.id).toBe("acme/toolkit");
    expect(entry?.registry).toBe("primary");
    expect(entry).not.toHaveProperty("git");
  });
});

describe("structured rewrite must not convert registry id to git", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("adding skills keeps id form", () => {
    const document = parseManifest(
      baseManifest({
        dependencies: {
          apm: [{ id: DEMO_ID, version: "1.0.0" }],
        },
      }),
    );
    const merge = getMergeApmDependencyUpdate();
    const next = merge(document as unknown as Record<string, unknown>, {
      id: DEMO_ID,
      version: "1.0.0",
      skills: ["alpha"],
    });
    const yaml = serializeManifest(next as unknown as BapmManifest);
    expect(yaml).toMatch(/id:\s*acme\/demo-pkg/);
    expect(yaml).toMatch(/skills:/);
    expect(yaml).toMatch(/alpha/);
    expect(yaml).not.toMatch(/(^|\n)\s*git:/);
    const [entry] = apmObjectEntries(parseManifest(next));
    expect(entry?.id).toBe(DEMO_ID);
    expect(stringList(entry?.skills)).toEqual(["alpha"]);
  });

  test("git-shaped replacement of registry identity is refused and original stays", () => {
    const document = parseManifest(
      baseManifest({
        dependencies: {
          apm: [{ id: DEMO_ID, version: "1.0.0" }],
        },
      }),
    );
    const originalYaml = serializeManifest(document);
    const merge = getMergeApmDependencyUpdate();
    expectThrowsMatching(
      () =>
        merge(document as unknown as Record<string, unknown>, {
          git: DEMO_ID,
          ref: "1.0.0",
          skills: ["some-skill"],
        }),
      /acme\/demo-pkg/,
    );
    expect(serializeManifest(document)).toBe(originalYaml);
    const [entry] = apmObjectEntries(document);
    expect(entry?.id).toBe(DEMO_ID);
    expect(entry).not.toHaveProperty("git");
  });

  test("install package-ref does not append a git sibling beside an id: row", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      `name: identity-match
version: 0.0.1
dependencies:
  apm:
    - id: ${DEMO_ID}
      version: "1.0.0"
`,
    );
    const ports = createFakePorts();
    const runInstall = getRunInstall();
    try {
      await runInstall({
        cwd: project.cwd,
        frozen: false,
        packageRefs: [DEMO_ID],
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      });
    } catch {
      /* resolve may fail without a registry; YAML mutation already happened */
    }
    const yaml = readProjectManifest(project.cwd);
    expect(yaml).toMatch(/id:\s*acme\/demo-pkg/);
    expect(yaml).not.toMatch(/(^|\n)\s*git:/);
    expect(yaml).not.toMatch(/(^|\n)\s*-\s+acme\/demo-pkg\s*$/m);
    const parsed = parseManifest(loadYamlDocument(yaml));
    const objects = apmObjectEntries(parsed);
    const strings = (parsed.dependencies?.apm ?? []).filter((e) => typeof e === "string");
    expect(objects.filter((e) => e.id === DEMO_ID)).toHaveLength(1);
    expect(strings).not.toContain(DEMO_ID);
  });
});
