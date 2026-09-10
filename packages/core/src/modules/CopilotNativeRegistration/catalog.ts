import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  COPILOT_NATIVE_LEDGER_REL,
  COPILOT_NATIVE_LEDGER_VERSION,
  COPILOT_NATIVE_MARKETPLACE_ID,
  COPILOT_NATIVE_MARKETPLACE_REL,
  COPILOT_NATIVE_MODULES_PATH,
  COPILOT_NATIVE_PLUGIN_DIR_REL,
} from "./constants.ts";
import type { AdmittedCopilotNativePlugin, CopilotNativeLedger } from "./types.ts";

export function writeCopilotNativeCatalog(
  cwd: string,
  admitted: AdmittedCopilotNativePlugin[],
): void {
  const abs = join(resolve(cwd), COPILOT_NATIVE_MARKETPLACE_REL);
  mkdirSync(dirname(abs), { recursive: true });
  const doc = {
    name: COPILOT_NATIVE_MARKETPLACE_ID,
    owner: { name: "bapm" },
    metadata: {
      description: "bapm-managed Copilot Agent Plugins marketplace (project scope)",
    },
    plugins: admitted.map((p) => ({
      name: p.pluginName,
      source: p.packagePathRel.replace(/\\/g, "/"),
      description: `Owned by package ${p.packageName}`,
    })),
  };
  writeFileSync(abs, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

export function writeCopilotNativeLedger(
  cwd: string,
  admitted: AdmittedCopilotNativePlugin[],
): void {
  const abs = join(resolve(cwd), COPILOT_NATIVE_LEDGER_REL);
  mkdirSync(dirname(abs), { recursive: true });
  const plugins: CopilotNativeLedger["plugins"] = {};
  for (const p of admitted) {
    plugins[p.pluginName] = {
      packageName: p.packageName,
      packagePath: p.packagePathRel.replace(/\\/g, "/"),
      ...(p.identity ? { identity: p.identity } : {}),
    };
  }
  const ledger: CopilotNativeLedger = {
    version: COPILOT_NATIVE_LEDGER_VERSION,
    marketplaceId: COPILOT_NATIVE_MARKETPLACE_ID,
    modulesPath: COPILOT_NATIVE_MODULES_PATH,
    ownedMarketplace: true,
    plugins,
  };
  writeFileSync(abs, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

export function readCopilotNativeLedger(cwd: string): CopilotNativeLedger | null {
  const abs = join(resolve(cwd), COPILOT_NATIVE_LEDGER_REL);
  if (!existsSync(abs)) return null;
  try {
    const raw = JSON.parse(readFileSync(abs, "utf8")) as CopilotNativeLedger;
    if (!raw || typeof raw !== "object") return null;
    if (raw.marketplaceId !== COPILOT_NATIVE_MARKETPLACE_ID) return null;
    if (raw.ownedMarketplace !== true) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Delete owned catalog + ledger; remove empty parent dirs under apm_modules/.github/plugin. */
export function clearCopilotNativeCatalogArtifacts(cwd: string): void {
  const root = resolve(cwd);
  for (const rel of [COPILOT_NATIVE_MARKETPLACE_REL, COPILOT_NATIVE_LEDGER_REL]) {
    const abs = join(root, rel);
    if (existsSync(abs)) rmSync(abs, { force: true });
  }
  const pluginDir = join(root, COPILOT_NATIVE_PLUGIN_DIR_REL);
  removeEmptyParents(pluginDir, join(root, COPILOT_NATIVE_MODULES_PATH));
}

function removeEmptyParents(startDir: string, stopAt: string): void {
  let current = startDir;
  const stop = resolve(stopAt);
  while (current.startsWith(stop) && current !== stop) {
    if (!existsSync(current)) {
      current = dirname(current);
      continue;
    }
    try {
      const entries = readDirSafe(current);
      if (entries.length > 0) break;
      rmSync(current, { recursive: true, force: true });
    } catch {
      break;
    }
    current = dirname(current);
  }
}

function readDirSafe(dir: string): string[] {
  return readdirSync(dir);
}
