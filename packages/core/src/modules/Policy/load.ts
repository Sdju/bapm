import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { discoverPolicyPath } from "./discover.ts";
import { PolicyError } from "./errors.ts";
import { parsePolicyDocument } from "./parse.ts";
import { discoverPolicyWithProviders } from "./providers.ts";
import { resolvePolicyChain } from "./resolve.ts";
import type { LoadPolicyOptions, LoadPolicyResult, PolicyDocument } from "./types.ts";
import { loadYamlDocument } from "./yaml-load.ts";
import type { GitRemoteEntry } from "./remotes.ts";
import type { FetchAncestor } from "./resolve.ts";

export type LoadPolicyExtendedOptions = LoadPolicyOptions & {
  /** Skip extends resolve (leaf only). */
  skipExtends?: boolean;
  providers?: string[];
  policyProviders?: string[];
  listGitRemotes?: (cwd?: string) => GitRemoteEntry[];
  remotes?: GitRemoteEntry[];
  fetchAncestor?: FetchAncestor;
  fetchPolicyUrl?: (url: string) => {
    ok?: boolean;
    text?: string;
    body?: string;
    status?: number;
    url?: string;
  };
  httpGet?: (url: string) => {
    ok?: boolean;
    text?: string;
    body?: string;
    status?: number;
    url?: string;
  };
  defaultFetchFailure?: "off" | "warn" | "block";
  implementationDefaultHost?: string;
  leafHostClass?: string;
};

/**
 * Discover → read → parse → resolve extends → effective document.
 * Explicit missing path fails closed. Provider-based discovery when no path.
 */
export function loadPolicy(options: LoadPolicyExtendedOptions = {}): LoadPolicyResult {
  if (options.path !== undefined) {
    return loadFromPath(options.path, options);
  }

  // Provider-ordered discovery (local first, then remote)
  const discovered = discoverPolicyWithProviders({
    cwd: options.cwd,
    providers: options.providers ?? options.policyProviders,
    path: options.path,
    listGitRemotes: options.listGitRemotes,
    remotes: options.remotes,
    fetchPolicyUrl: options.fetchPolicyUrl,
    httpGet: options.httpGet,
    defaultFetchFailure: options.defaultFetchFailure,
    implementationDefaultHost: options.implementationDefaultHost,
  });

  if ("absent" in discovered && discovered.absent) {
    throw new PolicyError(
      "POLICY_NOT_FOUND",
      "No policy found via discovery providers (local / remote)",
      { path: options.cwd },
    );
  }

  if (discovered.document) {
    return finalizeDocument(discovered.document, {
      sourcePath: discovered.path ?? discovered.url ?? discovered.source ?? "remote",
      sourceFilename: discovered.filename ?? "apm-policy.yml",
      options,
      warnings: [],
    });
  }

  if (!discovered.path) {
    throw new PolicyError("POLICY_NOT_FOUND", "Discovery yielded no policy path", {
      path: options.cwd,
    });
  }

  // Remote URL path without pre-parsed document — shouldn't happen often
  if (/^https?:\/\//i.test(discovered.path)) {
    throw new PolicyError(
      "POLICY_FETCH_FAILURE",
      `Remote policy missing document: ${discovered.path}`,
    );
  }

  return loadFromPath(discovered.path, options);
}

function loadFromPath(pathArg: string, options: LoadPolicyExtendedOptions): LoadPolicyResult {
  const discovered = discoverPolicyPath({ path: pathArg, cwd: options.cwd });
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
  return readParseResolve(path, discovered.filename ?? basename(path), options);
}

function readParseResolve(
  path: string,
  filename: string,
  options: LoadPolicyExtendedOptions,
): LoadPolicyResult {
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
  return finalizeDocument(document, {
    sourcePath: path,
    sourceFilename: filename,
    options,
    warnings,
  });
}

function finalizeDocument(
  document: PolicyDocument,
  args: {
    sourcePath: string;
    sourceFilename: string;
    options: LoadPolicyExtendedOptions;
    warnings: LoadPolicyResult["warnings"];
  },
): LoadPolicyResult {
  if (args.options.skipExtends || typeof document.extends !== "string") {
    return {
      document,
      policy: document,
      sourcePath: args.sourcePath,
      sourceFilename: args.sourceFilename,
      warnings: args.warnings,
    };
  }

  try {
    const resolved = resolvePolicyChain({
      cwd: args.options.cwd,
      path: args.sourcePath,
      leafPath: args.sourcePath,
      leaf: document,
      leafHostClass: args.options.leafHostClass,
      fetchAncestor: args.options.fetchAncestor,
      fetchPolicyUrl: args.options.fetchPolicyUrl,
      httpGet: args.options.httpGet,
    });
    return {
      document: resolved.document,
      policy: resolved.document,
      sourcePath: args.sourcePath,
      sourceFilename: args.sourceFilename,
      warnings: [...args.warnings, ...(resolved.warnings as LoadPolicyResult["warnings"])],
    };
  } catch (cause) {
    if (cause instanceof PolicyError) {
      // pl-010: fetch_failure block on extends fetch
      if (
        cause.code === "POLICY_EXTENDS_FETCH" &&
        (document.fetch_failure === "block" || args.options.defaultFetchFailure === "block")
      ) {
        throw new PolicyError(
          "POLICY_FETCH_FAILURE",
          `Policy extends fetch failed (fetch_failure: block): ${cause.message}`,
          { path: args.sourcePath, cause, details: cause.details },
        );
      }
      throw cause;
    }
    throw cause;
  }
}
