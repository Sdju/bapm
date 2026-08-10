import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite-plus";

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), "src");

export default defineConfig({
  resolve: {
    alias: {
      "@": srcRoot,
    },
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
