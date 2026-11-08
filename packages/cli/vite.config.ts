import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite-plus";

const pkgRoot = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(pkgRoot, "src");

export default defineConfig({
  resolve: {
    alias: {
      "@": srcRoot,
    },
  },
  test: {
    // Every test file gets a throwaway HOME; see tests/setup-home.ts.
    setupFiles: [resolve(pkgRoot, "../../tests/setup-home.ts")],
  },
  pack: {
    entry: {
      index: "src/index.ts",
      cli: "src/cli.ts",
    },
    dts: {
      tsgo: true,
    },
    // Scoped name @b-apm/cli would auto-bin as `cli`; publish command must be `bapm`.
    exports: {
      bin: {
        bapm: "./src/cli.ts",
      },
    },
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
