/**
 * Docs / README honesty: CLI and host integration are separate installs;
 * no “built-in Cursor” (promoted from opt-in-host-integrations acceptance).
 */
import { describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  docsArchitecturePath,
  docsGuideIndexPath,
  docsLandingPath,
  docsRoot,
  fileExists,
  readText,
  readmePath,
} from "./helpers.ts";

const supportedHostsPath = join(docsRoot, "guide/supported-hosts.md");

describe("docs · opt-in host integrations honesty", () => {
  test("root README does not claim Cursor is built into the CLI", () => {
    const readme = readText(readmePath);
    expect(readme).not.toMatch(/Уже встроен в CLI/i);
    expect(readme).not.toMatch(/Из коробки runtime\s*[—–-]\s*\*?\*?Cursor/i);
    expect(readme).toMatch(/@bapm\/integration-cursor/);
    expect(readme).toMatch(/targets:/);
    expect(readme).toMatch(/npm i -g @bapm\/cli/);
  });

  test("supported-hosts guide does not list Cursor as built-in / из коробки", () => {
    expect(fileExists(supportedHostsPath)).toBe(true);
    const page = readText(supportedHostsPath);
    expect(page).not.toMatch(/Cursor \(из коробки\)/i);
    expect(page).not.toMatch(/встроен в CLI/i);
    expect(page).not.toMatch(/\|\s*\*\*Cursor\*\*\s*\|\s*Да\b/);
    expect(page).toMatch(/targets:/);
    expect(page).toMatch(/@bapm\/integration-cursor/);
  });

  test("architecture overview does not call Cursor a CLI built-in runtime", () => {
    const arch = readText(docsArchitecturePath);
    expect(arch).not.toMatch(/built-in runtime \(Cursor\)/i);
    expect(arch).not.toMatch(/Built-in runtime\s*[—–-]\s*\*?\*?Cursor/i);
    expect(arch).toMatch(/@bapm\/integration-cursor|opt-in|object-map|targets:/i);
  });

  test("guide pages do not claim Cursor ships из коробки / Built-in: Cursor", () => {
    const guideIndex = readText(docsGuideIndexPath);
    expect(guideIndex).not.toMatch(/Из коробки runtime\s*[—–-]\s*\*?\*?Cursor/i);
    expect(guideIndex).toMatch(/@bapm\/integration-cursor|targets:/i);

    const pages = [
      docsLandingPath,
      docsGuideIndexPath,
      join(docsRoot, "guide/commands.md"),
      join(docsRoot, "guide/conformance.md"),
    ] as const;
    for (const path of pages) {
      expect(fileExists(path), path).toBe(true);
      const page = readText(path);
      expect(page, path).not.toMatch(/Из коробки\s*[—–-]\s*\*?\*?Cursor/i);
      expect(page, path).not.toMatch(/Из коробки runtime\s*[—–-]\s*\*?\*?Cursor/i);
      expect(page, path).not.toMatch(/Built-in:\s*Cursor/i);
      expect(page, path).not.toMatch(/Из коробки deploy идёт в Cursor/i);
    }
  });
});
