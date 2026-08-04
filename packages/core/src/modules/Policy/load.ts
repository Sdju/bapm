import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { discoverPolicyPath } from "./discover.ts";
import { PolicyError } from "./errors.ts";
import { parsePolicyDocument } from "./parse.ts";
import type { LoadPolicyOptions, LoadPolicyResult } from "./types.ts";
import { loadYamlDocument } from "./yaml-load.ts";

/**
 * Discover → read file → safe YAML → validate.
 * Explicit missing path fails closed. Absent dual-read is not an error here —
 * callers must discover first or pass an explicit path.
 */
export function loadPolicy(options: LoadPolicyOptions = {}): LoadPolicyResult {
  if (options.path !== undefined) {
    return loadExplicit(options.path, options.cwd);
  }

  const discovered = discoverPolicyPath({ cwd: options.cwd });
  if ("absent" in discovered && discovered.absent) {
    throw new PolicyError(
      "POLICY_NOT_FOUND",
      "No local policy file found (neither apm-policy.yml nor bapm-policy.yml)",
      { path: options.cwd },
    );
  }

  const path = discovered.path;
  return readAndParse(path, discovered.filename);
}

function loadExplicit(pathArg: string, cwd?: string): LoadPolicyResult {
  const discovered = discoverPolicyPath({ path: pathArg, cwd });
  if ("absent" in discovered && discovered.absent) {
    throw new PolicyError("POLICY_MISSING_FILE", `Policy file not found: ${pathArg}`, {
      path: pathArg,
    });
  }
  const path = discovered.path;
  if (!existsSync(path)) {
    throw new PolicyError("POLICY_MISSING_FILE", `Policy file not found: ${path}`, {
      path,
    });
  }
  return readAndParse(path, discovered.filename ?? basename(path));
}

function readAndParse(path: string, filename: string): LoadPolicyResult {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (cause) {
    throw new PolicyError("POLICY_MISSING_FILE", `Policy file not found: ${path}`, {
      path,
      cause,
    });
  }

  const raw = loadYamlDocument(text, path);
  const { document, warnings } = parsePolicyDocument(raw);

  return {
    document,
    policy: document,
    sourcePath: path,
    sourceFilename: filename,
    warnings,
  };
}
