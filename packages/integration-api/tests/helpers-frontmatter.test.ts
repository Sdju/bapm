import { describe, expect, test } from "vite-plus/test";
import { frontmatterList, parseFrontmatter, renderFrontmatter } from "../src/index.ts";

describe("parseFrontmatter", () => {
  test("returns the whole source as body without fences", () => {
    const parsed = parseFrontmatter("# Hello\n");
    expect(parsed.hasFrontmatter).toBe(false);
    expect(parsed.fields).toEqual([]);
    expect(parsed.body).toBe("# Hello\n");
  });

  test("parses scalars, inline lists, and block lists preserving line order", () => {
    const parsed = parseFrontmatter(
      `---\nname: demo\ndescription: "quoted"\npaths: [a, "b"]\ntools:\n  - read\n  - write\n---\nBody\n`,
    );
    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.fields.map((field) => field.key)).toEqual([
      "name",
      "description",
      "paths",
      "tools",
    ]);
    expect(parsed.fields[0]?.value).toBe("demo");
    expect(frontmatterList(parsed.fields[2])).toEqual(["a", "b"]);
    expect(frontmatterList(parsed.fields[3])).toEqual(["read", "write"]);
    expect(parsed.body).toBe("Body\n");
  });

  test("supports scalar comma splitting on request", () => {
    const parsed = parseFrontmatter(`---\napplyTo: src/**, tests/**\n---\nBody`);
    const field = parsed.fields[0];
    expect(frontmatterList(field)).toEqual(["src/**, tests/**"]);
    expect(frontmatterList(field, { splitScalarCommas: true })).toEqual(["src/**", "tests/**"]);
  });

  test("preserves non-key lines before the first field as prelude", () => {
    const parsed = parseFrontmatter(`---\n# leading comment\ndescription: x\n---\nBody\n`);
    expect(parsed.prelude).toEqual(["# leading comment"]);
    expect(parsed.fields[0]?.key).toBe("description");
  });
});

describe("renderFrontmatter", () => {
  test("renders prepared lines and normalizes the body tail", () => {
    expect(renderFrontmatter(["name: demo"], "Body\n\n")).toBe("---\nname: demo\n---\nBody\n");
  });

  test("emits no fences when all fields were dropped", () => {
    expect(renderFrontmatter([], "Body\n\n")).toBe("Body\n");
  });
});
