/**
 * cli-runtime-surface — user-facing help never leaks requirement IDs or milestone labels.
 */
import { describe, expect, test } from "vite-plus/test";
import { withCapturedIo } from "../find/helpers.ts";
import { runCli } from "../../src/index.ts";

const COMMANDS = [
  [],
  ["install"],
  ["uninstall"],
  ["update"],
  ["outdated"],
  ["deps"],
  ["compile"],
  ["init"],
  ["pack"],
  ["publish"],
  ["plugin"],
  ["approve"],
  ["deny"],
  ["policy"],
  ["audit"],
  ["doctor"],
  ["cache"],
  ["find"],
  ["prune"],
  ["view"],
];

const INTERNAL_ID = /\b(?:req-)?[a-z]{2}-\d{3}\b|\bM\d{1,2}\b/;

describe("help surface has no internal requirement IDs", () => {
  test.each(COMMANDS.map((argv) => [argv.join(" ") || "(top-level)", argv] as const))(
    "%s --help",
    async (_label, argv) => {
      const { stdout, stderr } = await withCapturedIo(() => runCli([...argv, "--help"]));
      const text = [...stdout, ...stderr].join("\n");
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(INTERNAL_ID);
    },
  );
});
