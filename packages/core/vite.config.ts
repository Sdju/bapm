import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const pkgRoot = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(pkgRoot, "src");
/** Test-only resolve: e2e imports cursor without core package.json hard dep. */
const targetCursorEntry = resolve(pkgRoot, "../target-cursor/src/index.ts");

export default defineConfig({
  resolve: {
    alias: {
      "@": srcRoot,
      "bapm-target-cursor": targetCursorEntry,
    },
  },
  pack: {
    dts: {
      tsgo: true,
    },
    exports: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    // Intentionally invalid YAML fixtures must not be parsed by oxfmt.
    ignorePatterns: [
      "tests/manifest/fixtures/**",
      "tests/lockfile/fixtures/**",
      "tests/resolve/fixtures/**",
    ],
  },
});
