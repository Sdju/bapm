/**
 * Vitest setup shared by every package: point the user home at a throwaway
 * directory so tests never read or write the developer's real `~/.bapm`.
 *
 * bapm resolves its user store through `os.homedir()` (see
 * `ExecutableTrust/userStore.ts` and `Marketplace/paths.ts`), which follows
 * `HOME` on POSIX and `USERPROFILE` on Windows. `XDG_CONFIG_HOME` is redirected
 * too for integrations that consult the XDG layout.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vite-plus/test";

const testHome = mkdtempSync(join(tmpdir(), "bapm-test-home-"));
const originalHome = process.env.HOME ?? process.env.USERPROFILE;

// Exposed for regression tests that assert the isolated HOME differs from the
// home the test process was started with. The first setup file loaded in a
// worker wins, so later reloads keep the real origin.
if (originalHome !== undefined && process.env.BAPM_TEST_ORIGINAL_HOME === undefined) {
  process.env.BAPM_TEST_ORIGINAL_HOME = originalHome;
}

process.env.HOME = testHome;
process.env.USERPROFILE = testHome;
process.env.XDG_CONFIG_HOME = join(testHome, ".config");
process.env.BAPM_TEST_HOME = testHome;

// An isolated HOME changes pnpm's derived store/config paths. Left at its
// default (`install`), `verify-deps-before-run` would try to reinstall the
// workspace whenever a test spawns pnpm. Tests set up node_modules already.
process.env.pnpm_config_verify_deps_before_run ??= "warn";

afterAll(() => {
  rmSync(testHome, { recursive: true, force: true });
});
