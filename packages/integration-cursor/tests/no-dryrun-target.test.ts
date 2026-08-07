/**
 * cursor target stays free of dry-run branches.
 */
import { expect, test, describe } from "vite-plus/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(pkgRoot, "src");

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...listTs(abs));
    else if (name.endsWith(".ts")) out.push(abs);
  }
  return out;
}

describe("target-cursor no dryRun knowledge", () => {
  test("createCursorIntegration / src has no dryRun parameter or branch", () => {
    const files = listTs(srcRoot);
    expect(files.length).toBeGreaterThan(0);
    const combined = files.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(combined).not.toMatch(/\bdryRun\b/);
    expect(combined).not.toMatch(/\bdry-run\b/);
  });
});
