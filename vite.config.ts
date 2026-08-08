import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    // Acceptance YAML fixtures include intentionally invalid documents.
    // Generated conformance statements must stay byte-stable for the drift gate.
    ignorePatterns: [
      "packages/core/tests/manifest/fixtures/**",
      "packages/core/tests/lockfile/fixtures/**",
      "packages/core/tests/resolve/fixtures/**",
      "CONFORMANCE.md",
      "CONFORMANCE.json",
      "AGENT_PLUGINS_COMPATIBILITY.md",
    ],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  // https://viteplus.dev/guide/commit-hooks
  staged: {
    "*.{js,mjs,cjs,ts,tsx}": "vp check --fix",
  },
  run: {
    cache: true,
  },
});
