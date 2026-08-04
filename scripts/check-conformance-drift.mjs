#!/usr/bin/env node
/**
 * Conformance statement drift gate.
 *
 * Regenerates CONFORMANCE.md / CONFORMANCE.json from the Mode B checklist,
 * then fails if `git diff` shows changes against the committed copies.
 *
 * Usage (from repo root):
 *   node scripts/check-conformance-drift.mjs
 *   pnpm run conformance:check
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
  return result;
}

const gen = run(process.execPath, [resolve(repoRoot, "scripts/gen-conformance-statement.mjs")]);
if (gen.status !== 0) {
  console.error(gen.stdout || "");
  console.error(gen.stderr || "");
  process.exit(gen.status ?? 1);
}
process.stdout.write(gen.stdout || "");

const diff = run("git", ["diff", "--exit-code", "--", "CONFORMANCE.md", "CONFORMANCE.json"]);
if (diff.status === 0) {
  console.log("conformance drift check: OK (no diff)");
  process.exit(0);
}

console.error("conformance drift check: FAILED — committed statement differs from regenerated output");
process.stderr.write(diff.stdout || "");
process.stderr.write(diff.stderr || "");
process.exit(diff.status ?? 1);
