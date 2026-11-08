/**
 * Test-only module-resolution isolation for CLI invocations.
 *
 * `vp test` launches workers with `NODE_PATH` pointing at the workspace
 * hoisted store (`<repo>/node_modules/.pnpm/node_modules`). Node snapshots
 * that value into its internal module search paths at startup, so simply
 * deleting the environment variable is not enough: `createRequire(...)`
 * still resolves workspace packages from there. That leaks canonical
 * `@b-apm/integration-*` packages into temp projects which deliberately do
 * not have them installed.
 *
 * Temporarily clear `NODE_PATH` and re-run Node's path initialization while
 * the CLI runs so module resolution is limited to the project the test
 * authored. Packages a test needs must be linked into that project's
 * `node_modules`.
 */
import { createRequire } from "node:module";

type NodeModuleWithInitPaths = { _initPaths?: () => void };

function moduleApi(): NodeModuleWithInitPaths {
  return createRequire(import.meta.url)("node:module") as NodeModuleWithInitPaths;
}

export async function withIsolatedModuleResolution<T>(fn: () => Promise<T>): Promise<T> {
  const savedNodePath = process.env.NODE_PATH;

  delete process.env.NODE_PATH;
  moduleApi()._initPaths?.();
  try {
    return await fn();
  } finally {
    if (savedNodePath === undefined) delete process.env.NODE_PATH;
    else process.env.NODE_PATH = savedNodePath;
    moduleApi()._initPaths?.();
  }
}
