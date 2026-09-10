import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadYamlDocument } from "@/common/yaml/loadDocument.ts";
import { APM_MANIFEST_FILE, BAPM_MANIFEST_FILE } from "@/modules/Manifest";
import { ensureMarketplacePathWithin } from "../PackOutputs/profiles.ts";
import { findPluginJson } from "./findPluginJson.ts";
import type { LocalVersionRead } from "./types.ts";

export const MAX_PLUGIN_JSON_BYTES = 1024 * 1024;

function isRegularFile(path: string): boolean {
  try {
    const st = lstatSync(path);
    return st.isFile() && !st.isSymbolicLink();
  } catch {
    return false;
  }
}

function existsOrSymlink(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return existsSync(path);
  }
}

/**
 * Read local package version: dual-read OpenAPM YAML authoritative; else plugin.json.
 * Prefered manifest present ⇒ no plugin.json fallback (APM fail-closed).
 */
export function readLocalVersion(projectRoot: string, relSource: string): LocalVersionRead {
  const packageRoot = resolve(projectRoot, relSource);
  const apmPath = join(packageRoot, APM_MANIFEST_FILE);
  const bapmPath = join(packageRoot, BAPM_MANIFEST_FILE);
  const hasApm = existsOrSymlink(apmPath);
  const hasBapm = existsOrSymlink(bapmPath);

  if (hasApm && hasBapm) {
    return { version: null, status: "invalid_yaml_manifest" };
  }

  const preferred = hasApm ? apmPath : hasBapm ? bapmPath : undefined;
  if (preferred) {
    return readPreferredYamlVersion(preferred, projectRoot);
  }

  return readPluginJsonVersion(packageRoot);
}

function readPreferredYamlVersion(preferredPath: string, projectRoot: string): LocalVersionRead {
  try {
    ensureMarketplacePathWithin(preferredPath, projectRoot);
  } catch {
    return { version: null, status: "invalid_yaml_manifest" };
  }
  if (!isRegularFile(preferredPath)) {
    return { version: null, status: "invalid_yaml_manifest" };
  }
  let raw: unknown;
  try {
    const text = readFileSync(preferredPath, "utf8");
    raw = loadYamlDocument(text, preferredPath);
  } catch {
    return { version: null, status: "invalid_yaml" };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: null, status: "invalid_yaml" };
  }
  const version = (raw as Record<string, unknown>).version;
  if (typeof version !== "string" || !version.trim()) {
    return { version: null, status: "missing_version" };
  }
  return { version: version.trim(), status: "ok" };
}

function readPluginJsonVersion(packageRoot: string): LocalVersionRead {
  const pluginJson = findPluginJson(packageRoot);
  if (!pluginJson) {
    return { version: null, status: "no_apm_yml" };
  }
  if (!isRegularFile(pluginJson)) {
    return { version: null, status: "invalid_plugin_json" };
  }
  try {
    ensureMarketplacePathWithin(pluginJson, packageRoot);
    const st = lstatSync(pluginJson);
    if (st.size > MAX_PLUGIN_JSON_BYTES) {
      return { version: null, status: "invalid_plugin_json" };
    }
    const text = readFileSync(pluginJson, "utf8");
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { version: null, status: "invalid_plugin_json" };
    }
    const version = (raw as Record<string, unknown>).version;
    if (typeof version !== "string" || !version.trim()) {
      return { version: null, status: "missing_plugin_version" };
    }
    const trimmed = version.trim();
    if (!isPrintableAscii(trimmed)) {
      return { version: null, status: "invalid_plugin_version" };
    }
    return { version: trimmed, status: "ok" };
  } catch {
    return { version: null, status: "invalid_plugin_json" };
  }
}

function isPrintableAscii(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    // Printable ASCII excluding DEL (APM str.isprintable + isascii)
    if (code < 0x20 || code > 0x7e) return false;
  }
  return true;
}
