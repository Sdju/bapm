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
});
