import type { ManifestWarning } from "./errors.ts";
import { ManifestError } from "./errors.ts";
import { isExemptInsecureHost } from "./registryUrl.ts";
import { isValidTargetToken } from "./targets.ts";
import type {
  BapmManifest,
  DependencyEntry,
  DependencyLists,
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

export type ParseManifestResult = {
  document: BapmManifest;
  warnings: ManifestWarning[];
};

/**
 * Validate a pre-parsed JS value as an OpenAPM/APM project manifest.
 * Retains unknown top-level and `x-*` keys on the returned document.
 */
export function parseManifestDocument(input: unknown): ParseManifestResult {
  const warnings: ManifestWarning[] = [];

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      "Manifest must contain a YAML object/mapping at the document root",
    );
  }

  const raw = input as Record<string, unknown>;

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

  let normalizedTarget: string | TargetIntegrationMap | undefined;
  let normalizedTargets: string[] | TargetIntegrationMap | undefined;

  if ("target" in raw && raw.target !== undefined) {
    normalizedTarget = parseTargetOrTargetsField(raw.target, "target");
  }

  if ("targets" in raw && raw.targets !== undefined) {
    normalizedTargets = parseTargetOrTargetsField(raw.targets, "targets");
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

  if ("dependencies" in raw) {
    document.dependencies = validateDependencyBlock(raw.dependencies, "dependencies");
  }
  if ("devDependencies" in raw) {
    document.devDependencies = validateDependencyBlock(raw.devDependencies, "devDependencies");
  }
  if ("registries" in raw) {
    document.registries = validateRegistries(raw.registries);
  }

  return { document, warnings };
}

/** Back-compat entry for already-loaded JS objects. */
export function parseManifest(input: unknown): BapmManifest {
  return parseManifestDocument(input).document;
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
    if (
      localVal !== true &&
      localVal !== null &&
      !(typeof localVal === "string")
    ) {
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

  return { ...obj } as ObjectDependency;
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
 * Dual-shape `target` / `targets`: legacy string|string[] or host→package object map.
 * Map keys are mf-005; values are trimmed non-empty npm specifier strings.
 */
function parseTargetOrTargetsField(
  value: unknown,
  field: "target" | "targets",
): string | string[] | TargetIntegrationMap {
  if (field === "target") {
    if (typeof value === "string") {
      if (!value.trim()) {
        throw new ManifestError(
          "MANIFEST_VALIDATION",
          'Manifest "target" must be a non-empty string (vendor ids x-<vendor>-<name> allowed)',
          { path: "target" },
        );
      }
      assertValidTargetToken(value, "target");
      return value;
    }
    if (isPlainObject(value)) {
      return parseTargetIntegrationMap(value, "target");
    }
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      'Manifest "target" must be a non-empty string or a non-empty object mapping (host id → package)',
      { path: "target" },
    );
  }

  // targets
  if (Array.isArray(value)) {
    if (value.some((t) => typeof t !== "string" || !t.trim())) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        'Manifest "targets" must be an array of non-empty strings or a string-valued object mapping',
        { path: "targets" },
      );
    }
    for (let i = 0; i < value.length; i++) {
      assertValidTargetToken(String(value[i]), `targets[${i}]`);
    }
    return value as string[];
  }
  if (isPlainObject(value)) {
    return parseTargetIntegrationMap(value, "targets");
  }
  throw new ManifestError(
    "MANIFEST_VALIDATION",
    'Manifest "targets" must be an array of non-empty strings or a string-valued object mapping',
    { path: "targets" },
  );
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
    out[trimmedKey] = trimmedVal;
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
