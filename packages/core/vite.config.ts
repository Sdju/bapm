import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const pkgRoot = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(pkgRoot, "src");

export default defineConfig({
  resolve: {
    alias: {
      "@": srcRoot,
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
