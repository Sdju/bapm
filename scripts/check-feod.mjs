import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFeodConfig } from "@o-feod/oxlint-structure-plugin";
import { configFromProject } from "@o-feod/oxlint-structure-plugin/configs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
// Run the Oxlint bundled with Vite+, so this check and `vp lint` agree on the engine.
const vitePlusRequire = createRequire(import.meta.resolve("vite-plus/package.json"));
const oxlintBin = join(dirname(vitePlusRequire.resolve("oxlint/package.json")), "bin", "oxlint");

/** Run the FEOD rules from feod.config.json with the Oxlint bundled by Vite+. */
export function checkFeod({ rootDir = projectRoot } = {}) {
  const loaded = loadFeodConfig({ rootDir });
  const roots = Object.keys(loaded.config.roots).filter((root) => existsSync(join(rootDir, root)));
  if (!roots.length) return [];

  const directory = mkdtempSync(join(tmpdir(), "bapm-feod-"));
  const configFile = join(directory, "oxlint.json");
  const config = configFromProject({ rootDir, preset: "recommended" });
  const pluginPath = fileURLToPath(import.meta.resolve("@o-feod/oxlint-structure-plugin"));
  writeFileSync(
    configFile,
    JSON.stringify({
      categories: { correctness: "off" },
      ...config,
      jsPlugins: config.jsPlugins.map((plugin) => ({ ...plugin, specifier: pluginPath })),
    }),
  );

  try {
    const result = spawnSync(
      process.execPath,
      [oxlintBin, "-c", configFile, "-f", "json", ...roots],
      {
        cwd: rootDir,
        encoding: "utf8",
        env: { ...process.env, VP_VERSION: undefined },
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
      },
    );
    if (result.error) throw result.error;

    let diagnostics;
    try {
      diagnostics = JSON.parse(result.stdout).diagnostics;
    } catch {
      throw new Error(
        `oxlint failed (${result.signal ?? result.status}): ${result.stderr || result.stdout}`,
      );
    }
    return diagnostics
      .filter((item) => item.code?.startsWith("feod-structure("))
      .map((item) => ({
        file: item.filename,
        rule: item.code.slice("feod-structure(".length, -1),
        message: item.message,
      }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const errors = checkFeod();
  if (errors.length) {
    console.error(errors.map((item) => `${item.file}: ${item.message} [${item.rule}]`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log("FEOD: layers, public API, submodules and inventory checked.");
  }
}
