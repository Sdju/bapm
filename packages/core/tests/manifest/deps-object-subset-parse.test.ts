/**
 * Parse fail-closed + retain object-form `skills:` / `targets:` (id: and git:).
 */
import { expect, test, describe } from "vite-plus/test";
import { parseManifest } from "@b-apm/core";
import {
  apmObjectEntries,
  baseManifest,
  expectThrowsMatching,
  stringList,
} from "./deps-subset-helpers.ts";

function parseApmEntry(entry: Record<string, unknown>): Record<string, unknown> {
  const document = parseManifest(
    baseManifest({
      dependencies: { apm: [entry] },
    }),
  );
  const [parsed] = apmObjectEntries(document);
  if (!parsed) throw new Error("expected object-form APM entry after parse");
  return parsed;
}

const registryEntry = {
  id: "acme/toolkit",
  version: "1.0.0",
  skills: ["deploy", "lint"],
  targets: ["cursor"],
};

const gitEntry = {
  git: "https://github.com/acme/toolkit.git",
  skills: ["deploy", "lint"],
  targets: ["cursor"],
};

describe("object-form skills/targets parse — accept and retain", () => {
  test("registry id entry with skills and targets is accepted and retained as string lists", () => {
    const parsed = parseApmEntry(registryEntry);
    expect(parsed.id).toBe("acme/toolkit");
    expect(stringList(parsed.skills)).toEqual(["deploy", "lint"]);
    expect(stringList(parsed.targets)).toEqual(["cursor"]);
  });

  test("git object-form uses the same subset grammar", () => {
    const parsed = parseApmEntry(gitEntry);
    expect(parsed.git).toBe("https://github.com/acme/toolkit.git");
    expect(stringList(parsed.skills)).toEqual(["deploy", "lint"]);
    expect(stringList(parsed.targets)).toEqual(["cursor"]);
  });

  test("duplicate skill names are deduped and sorted", () => {
    const parsed = parseApmEntry({
      id: "acme/toolkit",
      version: "1.0.0",
      skills: ["lint", "deploy", "lint"],
    });
    expect(stringList(parsed.skills)).toEqual(["deploy", "lint"]);
  });

  test("omitted skills and targets remain valid (no subset)", () => {
    const parsed = parseApmEntry({ id: "acme/toolkit", version: "1.0.0", registry: "primary" });
    expect(parsed.id).toBe("acme/toolkit");
    expect(parsed.skills).toBeUndefined();
    expect(parsed.targets).toBeUndefined();
  });
});

describe("object-form skills/targets parse — fail closed", () => {
  test.each([
    { label: "id", entry: { id: "acme/toolkit", version: "1.0.0", skills: [] } },
    { label: "git", entry: { git: "https://github.com/acme/toolkit.git", skills: [] } },
  ])("empty skills list rejected ($label)", ({ entry }) => {
    expectThrowsMatching(
      () => parseApmEntry(entry),
      /at least one skill|skills.*empty|non-empty.*skill/i,
    );
  });

  test.each([
    { label: "id", entry: { id: "acme/toolkit", version: "1.0.0", targets: [] } },
    { label: "git", entry: { git: "https://github.com/acme/toolkit.git", targets: [] } },
  ])("empty targets list rejected ($label)", ({ entry }) => {
    expectThrowsMatching(
      () => parseApmEntry(entry),
      /at least one target|targets.*empty|non-empty.*target/i,
    );
  });

  test.each([
    { label: "id", entry: { id: "acme/toolkit", version: "1.0.0", skills: ["../evil"] } },
    { label: "git", entry: { git: "https://github.com/acme/toolkit.git", skills: ["../evil"] } },
  ])("skill path traversal rejected ($label)", ({ entry }) => {
    expectThrowsMatching(() => parseApmEntry(entry), /traversal|unsafe|skill name|\.\./i);
  });

  test("absolute skill name rejected", () => {
    expectThrowsMatching(
      () => parseApmEntry({ id: "acme/toolkit", version: "1.0.0", skills: ["/abs"] }),
      /traversal|unsafe|absolute|skill name/i,
    );
  });

  test.each([
    { label: "id", entry: { id: "acme/toolkit", version: "1.0.0", targets: ["not-a-target"] } },
    {
      label: "git",
      entry: { git: "https://github.com/acme/toolkit.git", targets: ["not-a-host"] },
    },
  ])("unknown subset target rejected ($label)", ({ entry }) => {
    expectThrowsMatching(
      () => parseApmEntry(entry),
      /not-a-(target|host)|unknown target|invalid target/i,
    );
  });

  test("non-list skills scalar rejected", () => {
    expectThrowsMatching(
      () => parseApmEntry({ id: "acme/toolkit", version: "1.0.0", skills: "deploy" }),
      /skills|list|array/i,
    );
  });

  test("non-list skills mapping rejected", () => {
    expectThrowsMatching(
      () => parseApmEntry({ id: "acme/toolkit", version: "1.0.0", skills: { deploy: true } }),
      /skills|list|array/i,
    );
  });

  test("non-string skills item rejected", () => {
    expectThrowsMatching(
      () => parseApmEntry({ id: "acme/toolkit", version: "1.0.0", skills: [1] }),
      /skills|string/i,
    );
  });
});
