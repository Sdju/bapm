import { parseActiveField } from "./active.ts";
import { negotiateManifestContract, type ManifestContract } from "./contract.ts";
import { applyDepSubsetFields } from "./depSubset.ts";
import type { ManifestWarning } from "./errors.ts";
import { ManifestError } from "./errors.ts";
import { isManifestExtensionKey } from "./extensions.ts";
import { parsePresetsField } from "./presets.ts";
import { isExemptInsecureHost } from "./registryUrl.ts";
import { isValidTargetToken, normalizeTargetToken } from "./targets.ts";
import type {
  ActiveEntry,
  BapmManifest,
  DependencyEntry,
  DependencyLists,
  ManifestPreset,
  ObjectDependency,
  RegistryEntry,
  TargetIntegrationMap,
} from "./types.ts";

/** Mutually exclusive source discriminators (path may accompany git as virtual_path;
 * `registry` name may accompany `id` as named-registry pointer).
 * `marketplace` is non-normative OpenAPM form `{ name, marketplace, version? }`.
 * `local` is a bapm-only extension (not an OpenAPM wire discriminator). */
const SOURCE_KEYS = ["git", "id", "path", "registry", "marketplace", "local"] as const;
const SOURCE_KEYS_DISPLAY = "git|id|path|registry|marketplace|local";
/** Allowlisted object-dep meta keys (APM depEntry / reject_unknown_git_fields). */
const DEP_META_KEYS = new Set([
  "version",
  "ref",
  "alias",
  "skills",
  "targets",
  "allow_insecure",
  "type",
  "prerelease",
  /** Named registry pointer companion to `id:` (M10). */
  "registry",
  /** Plugin name for marketplace object form. */
  "name",
]);

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Top-level keys this client understands. Extension keys (`x-*`) are handled
 * separately. Unknown keys are retained (req-mf-006) but produce a warning so
 * a typo cannot silently become dead configuration (APM 0.35 parity).
 */
const KNOWN_TOP_LEVEL_KEYS = new Set([
  "$schema",
  "name",
  "version",
  "description",
  "author",
  "license",
  "default_host",
  "target",
  "targets",
  "type",
  "scripts",
  "includes",
  "registries",
  "replace",
  "dependencies",
  "devDependencies",
  "compilation",
  "policy",
  "marketplace",
  "allowExecutables",
  "executables",
  "lifecycle",
  "homepage",
  "repository",
  "keywords",
  "tags",
  "build",
  "manifestVersion",
  "schemaVersion",
  // bapm extensions understood by this client.
  "active",
  "presets",
  "env",
]);

/** Env-safe key shape for top-level `env` / `{bake:NAME}` identifiers. */
const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type ParseManifestResult = {
  document: BapmManifest;
  warnings: ManifestWarning[];
  /** Contract selected by `$schema`; absent means the working draft. */
  contract: ManifestContract;
};

export type ParseManifestOptions = {
  /**
   * APM applies root `replace:` rules only to the consumer manifest; dependency
   * manifests may still declare the block. bapm rejects it by default so a root
   * consumer never installs an upstream source by mistake.
   */
  allowReplace?: boolean;
};

/**
 * Validate top-level (or overlay) `env` as string→string with env-safe keys.
 * Empty string values are allowed (shape); bake still requires non-empty at lookup.
 */
export function validateManifestEnv(value: unknown, pathPrefix = "env"): Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Manifest "${pathPrefix}" must be a mapping of string keys to string values`,
      { path: pathPrefix },
    );
  }

  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const entryPath = `${pathPrefix}.${key}`;
    if (!ENV_KEY_RE.test(key)) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Manifest env key "${key}" is not env-safe (expected [A-Za-z_][A-Za-z0-9_]*)`,
        { path: entryPath, details: { key } },
      );
    }
    if (typeof entry !== "string") {
      throw new ManifestError("MANIFEST_VALIDATION", `Manifest "${entryPath}" must be a string`, {
        path: entryPath,
      });
    }
    out[key] = entry;
  }
  return out;
}

/**
 * Validate a pre-parsed JS value as an OpenAPM/APM project manifest.
 * Retains unknown top-level and `x-*` keys on the returned document.
 */
export function parseManifestDocument(
  input: unknown,
  options: ParseManifestOptions = {},
): ParseManifestResult {
  const warnings: ManifestWarning[] = [];

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      "Manifest must contain a YAML object/mapping at the document root",
    );
  }

  const raw = input as Record<string, unknown>;

  // Contract selector (`$schema`) is negotiated before any shape validation so
  // an unknown identity fails closed instead of silently using the draft.
  const contract = negotiateManifestContract(raw);

  for (const key of Object.keys(raw)) {
    if (KNOWN_TOP_LEVEL_KEYS.has(key) || isManifestExtensionKey(key)) continue;
    warnings.push({
      code: "MF_006_UNKNOWN_TOP_LEVEL",
      message:
        `Unknown top-level key "${key}" is retained but not interpreted. ` +
        `Rename it to x-${key.replace(/^x-/, "")} (OpenAPM x-[a-z][a-z0-9-]*) ` +
        `to declare a vendor extension, or remove it if it is a typo.`,
      path: key,
    });
  }

  assertReplaceSupported(raw, options);

  if ("workspaces" in raw) {
    throw new ManifestError("MANIFEST_VALIDATION", 'OpenAPM v0.1 rejects top-level "workspaces"', {
      path: "workspaces",
    });
  }

  if ("target" in raw && "targets" in raw) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      'Manifest must not declare both "target" and "targets"',
      { path: "target" },
    );
  }

  let normalizedTarget: string | string[] | TargetIntegrationMap | undefined;
  let normalizedTargets: string[] | TargetIntegrationMap | undefined;

  if ("target" in raw && raw.target !== undefined) {
    normalizedTarget = parseTargetOrTargetsField(raw.target, "target");
  }

  if ("targets" in raw && raw.targets !== undefined) {
    normalizedTargets = parseTargetOrTargetsField(raw.targets, "targets");
  }

  let normalizedActive: ActiveEntry[] | undefined;
  if ("active" in raw && raw.active !== undefined) {
    normalizedActive = parseActiveField(raw.active);
  }

  let normalizedPresets: ManifestPreset[] | undefined;
  if ("presets" in raw && raw.presets !== undefined) {
    normalizedPresets = parsePresetsField(raw.presets, validateDependencyBlock);
  }

  if (!("name" in raw)) {
    throw new ManifestError("MANIFEST_VALIDATION", 'Manifest requires "name"', {
      path: "name",
    });
  }
  if (typeof raw.name !== "string" || raw.name.length === 0) {
    throw new ManifestError("MANIFEST_VALIDATION", 'Manifest "name" must be a non-empty string', {
      path: "name",
    });
  }

  if (!("version" in raw)) {
    throw new ManifestError("MANIFEST_VALIDATION", 'Manifest requires "version"', {
      path: "version",
    });
  }
  if (typeof raw.version !== "string" || raw.version.length === 0) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      'Manifest "version" must be a non-empty string (quote numeric-looking versions in YAML)',
      { path: "version" },
    );
  }

  if (!SEMVER_RE.test(raw.version)) {
    warnings.push({
      code: "MF_004_NON_SEMVER",
      message: `Manifest version "${raw.version}" is not semver-shaped (non-blocking)`,
      path: "version",
    });
  }

  const document: BapmManifest = { ...raw, name: raw.name, version: raw.version };

  if (normalizedTarget !== undefined) {
    document.target = normalizedTarget;
  }
  if (normalizedTargets !== undefined) {
    document.targets = normalizedTargets;
  }
  if (normalizedActive !== undefined) {
    document.active = normalizedActive;
  }
  if (normalizedPresets !== undefined) {
    document.presets = normalizedPresets;
  }

  if ("env" in raw && raw.env !== undefined) {
    document.env = validateManifestEnv(raw.env);
  }

  if ("dependencies" in raw) {
    document.dependencies = validateDependencyBlock(raw.dependencies, "dependencies");
  }
  if ("devDependencies" in raw) {
    document.devDependencies = validateDependencyBlock(raw.devDependencies, "devDependencies");
  }
  if ("registries" in raw) {
    document.registries = validateRegistries(raw.registries);
  }

  return { document, warnings, contract };
}

/** Back-compat entry for already-loaded JS objects. */
export function parseManifest(input: unknown, options: ParseManifestOptions = {}): BapmManifest {
  return parseManifestDocument(input, options).document;
}

/**
 * Root `replace:` (APM 0.35 replacement rules) is unsupported. Refuse instead
 * of silently installing the upstream source where the user configured a fork
 * or local checkout.
 */
function assertReplaceSupported(raw: Record<string, unknown>, options: ParseManifestOptions): void {
  if (options.allowReplace) return;
  if (!("replace" in raw)) return;
  const value = raw.replace;
  // Absent/empty rules have no semantic effect; mirror APM's `parse_replace_block`.
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
    return;
  }

  const rules = describeReplacementRules(value);
  throw new ManifestError(
    "MANIFEST_REPLACE_UNSUPPORTED",
    `Manifest declares root "replace:" (${rules.join("; ")}), which bapm does not support. ` +
      `Refusing to continue because the replacement would be ignored and bapm would install ` +
      `the upstream source instead of the configured local checkout/fork. ` +
      `Remove the replace: block or use APM 0.35+ for this project.`,
    { path: "replace", details: { rules } },
  );
}

/** Describe replacement rules for the diagnostic without fully re-parsing them. */
function describeReplacementRules(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : [value];
  return entries.map((entry, index) => {
    const label = `replace[${index}]`;
    if (!isPlainObject(entry)) {
      return `${label}=${JSON.stringify(entry) ?? String(entry)}`;
    }
    const selector = isPlainObject(entry.for) ? entry.for : undefined;
    const source = isPlainObject(entry.with) ? entry.with : undefined;

    const selectorParts = [selector?.git, selector?.path]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .map((part) => part.trim());
    const selectorText = selectorParts.length > 0 ? selectorParts.join(" ") : "?";

    let sourceText = "?";
    if (source) {
      const git = typeof source.git === "string" ? source.git.trim() : "";
      const path = typeof source.path === "string" ? source.path.trim() : "";
      const ref = typeof source.ref === "string" ? source.ref.trim() : "";
      if (git) {
        sourceText = `git:${git}${ref ? `#${ref}` : ""}${path ? ` path:${path}` : ""}`;
      } else if (path) {
        sourceText = `path:${path}`;
      }
    }
    return `${label} ${selectorText} -> ${sourceText}`;
  });
}

function validateDependencyBlock(value: unknown, field: string): DependencyLists {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ManifestError("MANIFEST_VALIDATION", `Manifest "${field}" must be a mapping/object`, {
      path: field,
    });
  }

  const block = value as Record<string, unknown>;
  const out: DependencyLists = {};

  for (const [listKey, listVal] of Object.entries(block)) {
    if (listVal === undefined) continue;
    if (!Array.isArray(listVal)) {
      // Keep non-list sibling keys as-is (APM keeps raw for non-list); M1 only deep-validates lists.
      out[listKey] = listVal;
      continue;
    }

    if (listKey === "apm") {
      out.apm = listVal.map((entry, i) => validateApmEntry(entry, `${field}.apm[${i}]`));
    } else {
      // mcp / lsp / other lists: retain without deep resolve; still require list shape.
      out[listKey] = listVal;
    }
  }

  return out;
}

function validateApmEntry(entry: unknown, path: string): DependencyEntry {
  if (typeof entry === "string") {
    // Bare list item `- local` → bapm default local source (same as `{ local: true }`).
    if (entry.trim() === "local") {
      return { local: true };
    }
    return entry;
  }

  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Dependency entry at ${path} must be a string or object`,
      { path },
    );
  }

  const obj = entry as Record<string, unknown>;
  const hasGit = "git" in obj;
  const hasId = "id" in obj;
  const hasPath = "path" in obj;
  const hasRegistry = "registry" in obj;
  const hasMarketplace = "marketplace" in obj;
  const hasLocal = "local" in obj;

  // `path` with `git` is a virtual_path companion, not a second source kind (APM parse_from_dict).
  // `registry` with `id` is a named-registry pointer companion (M10), not a second source.
  // `local` is never a companion — it is always its own source kind (bapm extension).
  const sourceKinds: string[] = [];
  if (hasGit) sourceKinds.push("git");
  if (hasId) sourceKinds.push("id");
  if (hasPath && !hasGit) sourceKinds.push("path");
  // Bare `registry:` without `id` counts as registry source; with `id` it is meta only.
  if (hasRegistry && !hasId) sourceKinds.push("registry");
  if (hasMarketplace) sourceKinds.push("marketplace");
  if (hasLocal) sourceKinds.push("local");

  const unknownKeys = Object.keys(obj).filter(
    (k) =>
      !SOURCE_KEYS.includes(k as (typeof SOURCE_KEYS)[number]) &&
      !DEP_META_KEYS.has(k) &&
      !k.startsWith("x-"),
  );

  if (sourceKinds.length === 0) {
    if (unknownKeys.length > 0) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Dependency at ${path} has unknown source kind "${unknownKeys[0]}"; expected one of ${SOURCE_KEYS_DISPLAY}`,
        { path },
      );
    }
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Dependency at ${path} has no source key; expected one of ${SOURCE_KEYS_DISPLAY}`,
      { path },
    );
  }

  if (hasId && hasGit) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Dependency at ${path} must not specify both id and git sources`,
      { path },
    );
  }

  if (sourceKinds.length > 1) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Dependency at ${path} must have exactly one source kind (${SOURCE_KEYS_DISPLAY}); found ${sourceKinds.join(", ")}`,
      { path },
    );
  }

  if (hasLocal) {
    const localVal = obj.local;
    if (localVal === false) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Dependency at ${path}: "local" must not be false (use true, null/empty, or a non-empty path string)`,
        { path },
      );
    }
    if (localVal !== true && localVal !== null && !(typeof localVal === "string")) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Dependency at ${path}: "local" must be true, null/empty, or a non-empty string path`,
        { path },
      );
    }
  }

  if (hasMarketplace) {
    const mp = obj.marketplace;
    if (typeof mp !== "string" || !mp.trim()) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Dependency at ${path}: "marketplace" field must be a non-empty string`,
        { path },
      );
    }
    const name = obj.name;
    if (typeof name !== "string" || !name.trim()) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Dependency at ${path}: marketplace form requires a non-empty "name"`,
        { path },
      );
    }
  }

  if (hasGit) {
    const gitVal = obj.git;
    if (typeof gitVal !== "string" || !gitVal.trim()) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Dependency at ${path}: "git" field must be a non-empty string`,
        { path },
      );
    }
    if (gitVal === "parent") {
      if (!hasPath || typeof obj.path !== "string" || !obj.path.trim()) {
        throw new ManifestError(
          "MANIFEST_VALIDATION",
          `Dependency at ${path}: git: "parent" requires a non-empty "path" field`,
          { path },
        );
      }
    } else if (hasPath) {
      if (typeof obj.path !== "string" || !obj.path.trim()) {
        throw new ManifestError(
          "MANIFEST_VALIDATION",
          `Dependency at ${path}: "path" companion to git must be a non-empty string`,
          { path },
        );
      }
    }
  }

  if (unknownKeys.length > 0) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Dependency at ${path} has unknown source kind key "${unknownKeys[0]}"`,
      { path },
    );
  }

  return applyDepSubsetFields(obj, path) as ObjectDependency;
}

function validateRegistries(value: unknown): Record<string, RegistryEntry | string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ManifestError("MANIFEST_VALIDATION", 'Manifest "registries" must be a mapping', {
      path: "registries",
    });
  }

  const raw = value as Record<string, unknown>;
  const out: Record<string, RegistryEntry | string> = {};

  for (const [name, entry] of Object.entries(raw)) {
    // `default` is a special-case pointer to a registry name, not a URL entry
    // (APM _parse_registries_block / OpenAPM §4.2.3).
    if (name === "default") continue;

    const path = `registries.${name}`;

    if (typeof entry === "string") {
      assertRegistryHttpUrl(entry, path, { registryName: name });
      out[name] = entry;
      continue;
    }

    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Registry entry ${path} must be a string URL or object`,
        { path },
      );
    }

    const obj = entry as Record<string, unknown>;

    if ("token" in obj) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Registry entry ${path} must not embed a token in YAML`,
        { path: `${path}.token` },
      );
    }

    for (const key of Object.keys(obj)) {
      if (key === "url" || key === "aliases" || key === "insecure" || key.startsWith("x-")) {
        continue;
      }
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Registry entry ${path} has unknown key "${key}"`,
        { path: `${path}.${key}` },
      );
    }

    if (typeof obj.url !== "string") {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Registry entry ${path} requires a string "url"`,
        { path: `${path}.url` },
      );
    }

    let insecure: boolean | undefined;
    if ("insecure" in obj) {
      if (typeof obj.insecure !== "boolean") {
        throw new ManifestError(
          "MANIFEST_VALIDATION",
          `Registry entry ${path}.insecure must be a boolean`,
          { path: `${path}.insecure` },
        );
      }
      insecure = obj.insecure;
    }

    let aliases: string[] | undefined;
    if ("aliases" in obj) {
      if (!Array.isArray(obj.aliases)) {
        throw new ManifestError(
          "MANIFEST_VALIDATION",
          `Registry entry ${path}.aliases must be an array of hostname strings`,
          { path: `${path}.aliases` },
        );
      }
      aliases = [];
      for (let i = 0; i < obj.aliases.length; i += 1) {
        const alias = obj.aliases[i];
        if (typeof alias !== "string" || !alias.trim()) {
          throw new ManifestError(
            "MANIFEST_VALIDATION",
            `Registry entry ${path}.aliases[${i}] must be a non-empty hostname string`,
            { path: `${path}.aliases` },
          );
        }
        aliases.push(alias.trim().toLowerCase());
      }
    }

    assertRegistryHttpUrl(obj.url, path, { registryName: name, insecure });
    out[name] = {
      ...obj,
      url: obj.url,
      ...(insecure !== undefined ? { insecure } : {}),
      ...(aliases !== undefined ? { aliases } : {}),
    } as RegistryEntry;
  }

  if ("default" in raw) {
    const defaultValue = raw.default;
    if (typeof defaultValue !== "string" || !defaultValue.trim()) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        'Manifest "registries.default" must be a non-empty string naming a declared registry',
        { path: "registries.default" },
      );
    }
    const defaultName = defaultValue.trim();
    if (!(defaultName in out)) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Manifest "registries.default" refers to unconfigured registry "${defaultName}"`,
        { path: "registries.default" },
      );
    }
    out.default = defaultName;
  }

  return out;
}

/** mf-005: canonical | alias | x-<vendor>-<name>; diagnostic names the bad token. */
function assertValidTargetToken(token: string, path: string): void {
  if (isValidTargetToken(token)) return;
  throw new ManifestError(
    "MANIFEST_VALIDATION",
    `Invalid target token "${token}" (mf-005): must be a canonical host id, recognised alias, or x-<vendor>-<name>`,
    { path, details: { token } },
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Dual-shape `target` / `targets`: legacy scalar / CSV / string array or
 * host→package object map. Scalar and CSV forms normalize to a canonical
 * string list, matching APM `parse_targets_field` / `parse_target_field`.
 * Map keys are mf-005; values are trimmed non-empty npm specifier strings.
 */
function parseTargetOrTargetsField(
  value: unknown,
  field: "target",
): string | string[] | TargetIntegrationMap;
function parseTargetOrTargetsField(
  value: unknown,
  field: "targets",
): string[] | TargetIntegrationMap;
function parseTargetOrTargetsField(
  value: unknown,
  field: "target" | "targets",
): string | string[] | TargetIntegrationMap {
  if (field === "target") {
    if (typeof value === "string") {
      const tokens = splitTargetCsv(value, "target");
      assertValidTargetTokens(tokens, "target");
      const normalized = normalizeTargetTokenList(tokens);
      // Single-token scalar keeps the legacy string projection; CSV / list
      // forms are canonical arrays so callers never re-split.
      return normalized.length === 1 ? normalized[0]! : normalized;
    }
    if (Array.isArray(value)) {
      assertValidTargetTokens(value, "target");
      const normalized = normalizeTargetTokenList(value as string[]);
      return normalized.length === 1 ? normalized[0]! : normalized;
    }
    if (isPlainObject(value)) {
      return parseTargetIntegrationMap(value, "target");
    }
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      'Manifest "target" must be a non-empty string (optionally comma-separated), a string array, or a non-empty object mapping (host id → package)',
      { path: "target" },
    );
  }

  // targets
  if (typeof value === "string") {
    const tokens = splitTargetCsv(value, "targets");
    assertValidTargetTokens(tokens, "targets");
    return normalizeTargetTokenList(tokens);
  }
  if (Array.isArray(value)) {
    assertValidTargetTokens(value, "targets");
    return normalizeTargetTokenList(value as string[]);
  }
  if (isPlainObject(value)) {
    return parseTargetIntegrationMap(value, "targets");
  }
  throw new ManifestError(
    "MANIFEST_VALIDATION",
    'Manifest "targets" must be a non-empty string (optionally comma-separated), an array of non-empty strings, or a string-valued object mapping',
    { path: "targets" },
  );
}

/** APM CSV sugar: `"claude,copilot"` → `["claude", "copilot"]`. */
function splitTargetCsv(value: string, field: "target" | "targets"): string[] {
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Manifest "${field}" must contain at least one non-empty target token`,
      { path: field },
    );
  }
  return tokens;
}

function assertValidTargetTokens(tokens: unknown[], field: "target" | "targets"): void {
  if (tokens.some((t) => typeof t !== "string" || !t.trim())) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Manifest "${field}" must be an array of non-empty strings or a string-valued object mapping`,
      { path: field },
    );
  }
  for (let i = 0; i < tokens.length; i++) {
    assertValidTargetToken(String(tokens[i]), `${field}[${i}]`);
  }
}

function parseTargetIntegrationMap(
  value: Record<string, unknown>,
  field: "target" | "targets",
): TargetIntegrationMap {
  const keys = Object.keys(value);
  if (keys.length === 0) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Manifest "${field}" object map must not be empty`,
      { path: field },
    );
  }

  const out: TargetIntegrationMap = {};
  const sourceKeyByCanonical = new Map<string, string>();
  for (const key of keys) {
    const trimmedKey = key.trim();
    const entryPath = `${field}.${trimmedKey || key}`;
    assertValidTargetToken(key, entryPath);

    const rawVal = value[key];
    if (typeof rawVal !== "string") {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Manifest "${field}" map value for "${trimmedKey || key}" must be a string`,
        { path: entryPath },
      );
    }
    const trimmedVal = rawVal.trim();
    if (!trimmedVal) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Manifest "${field}" map value for "${trimmedKey || key}" must be a non-empty string`,
        { path: entryPath },
      );
    }

    const canonicalKey = normalizeTargetToken(trimmedKey);
    const previousKey = sourceKeyByCanonical.get(canonicalKey);
    if (previousKey !== undefined) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Manifest "${field}" object map has duplicate host "${canonicalKey}" after alias normalization ("${previousKey}" and "${trimmedKey}")`,
        { path: entryPath, details: { token: trimmedKey, canonical: canonicalKey } },
      );
    }
    sourceKeyByCanonical.set(canonicalKey, trimmedKey);
    out[canonicalKey] = trimmedVal;
  }
  return out;
}

/** Canonicalise aliases and drop duplicates while preserving first-seen order. */
function normalizeTargetTokenList(tokens: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    const canonical = normalizeTargetToken(token);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

function assertRegistryHttpUrl(
  url: string,
  path: string,
  options: { registryName: string; insecure?: boolean },
): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Registry URL at ${path} is not a valid URL: ${url}`,
      { path },
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Registry URL at ${path} must use http(s) scheme, got ${parsed.protocol.replace(":", "")}`,
      { path },
    );
  }
  if (parsed.protocol === "https:") return;

  // http:// — require insecure: true or exempt host (loopback / ::1 / RFC1918)
  if (options.insecure === true) return;
  if (isExemptInsecureHost(parsed.hostname)) return;

  throw new ManifestError(
    "MANIFEST_VALIDATION",
    `Registry "${options.registryName}" uses http:// without insecure: true (set registries.${options.registryName}.insecure: true or use an exempt loopback/RFC1918 host)`,
    { path, details: { registry: options.registryName, url } },
  );
}
