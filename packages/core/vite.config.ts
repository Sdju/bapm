import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), "src");

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
      "tests/acceptance/m1-manifest-yaml-dual-read/fixtures/**",
      "tests/acceptance/m2-lockfile-yaml-dual-read/fixtures/**",
    ],
  },
});
