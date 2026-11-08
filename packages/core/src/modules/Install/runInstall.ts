import { isAbsolute, join, relative, resolve } from "node:path";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import type {
  BapmIntegration,
  ConfigureMcpReport,
  DeploymentScope,
  MaterializeReport,
  IntegrationRegistry,
  McpServerConfig,
} from "@b-apm/integration-api";
import { getConfigureMcp } from "@b-apm/integration-api";
import {
  loadManifest,
  resolveActive,
  withEffectiveDirectDeps,
  type BapmManifest,
  type DependencyEntry,
  type ObjectDependency,
} from "@/modules/Manifest";
import {
  collectTreeSha256Violations,
  loadEffectiveLockfileOrNull,
  partitionAndWriteLockfiles,
  type LockfileDocument,
} from "@/modules/Lockfile";
import {
  APM_MODULES_DIR,
  DEFAULT_PARALLEL_DOWNLOADS,
  downloadPackages,
  ensureLocalSourcesUntracked,
  materializeRegistryNodes,
  resolveAndLock,
  resolveDependencyGraph,
  type DownloadPackageSpec,
  type ResolvedNode,
} from "@/modules/Resolver";
import {
  assertPolicyGateAllows,
  runPolicyGate,
  type PolicyCandidate,
  type PolicyExecutables,
} from "@/modules/Policy";
import {
  discoverPrimitives,
  resolvePrimitiveConflicts,
  type AttributedPrimitive,
} from "@/modules/Primitives";
import {
  discoverAgentPluginSkills,
  discoverAgentPluginDeclaredPaths,
  AgentPluginsError,
} from "@/modules/AgentPlugins";
import {
  admitCopilotNativePlugins,
  filterPrimitivesForCopilotNative,
  rebuildCopilotNativeRegistration,
} from "@/modules/CopilotNativeRegistration";
import { detectLifecycleUnsupported } from "@/modules/Lifecycle";
import { detectUnsupportedDeclarations } from "@/modules/LspCanvas";
import { extractPackArchive } from "@/modules/Pack";
import {
  isPackageMentionedInGrants,
  loadUserExecutableGrants,
  normalizeTrustBin,
  parseExecutableGrants,
  resolveBinDeployConsent,
  resolveExecutableTrust,
  userGrantsToSurface,
  type ExecutableGrantSurface,
} from "@/modules/ExecutableTrust";
import {
  applyMcpInventoryToLock,
  bakeMcpServerMaps,
  collectMcpServers,
  McpEnvBakeError,
  resolveMcpServerFromRegistry,
  scrubMcpInventory,
  type CollectedMcpServer,
  type McpRegistryLookup,
} from "@/modules/Mcp";
import { defaultBinDeployRoot, discoverPackageBinFiles, materializeBinFiles } from "./binDeploy.ts";
import {
  applyDeployedHashesToLock,
  cleanupOrphanDeployedFiles,
  collectDeployedHashes,
  verifyDeployedFileHashes,
} from "./deployedInventory.ts";
import { InstallError } from "./errors.ts";
import { enforceFrozen } from "./frozen.ts";
import { assertFrozenDeployInventory } from "./frozenUnderRecorded.ts";
import { gateInsecureBeforeFetch, normalizeAllowInsecureHosts } from "./insecurePolicy.ts";
import {
  assertMarketplacePackageRefsResolvable,
  autoCreateMinimalManifest,
  manifestExistsAt,
  normalizeExcludeIds,
  normalizePackageRefs,
  packageRefToEntry,
  writeManifestWithPackageRefs,
} from "./packageRefs.ts";
import { declaredTargetIds } from "./targets.ts";
import type { InstallOnlyMode, InstallResult, RunInstallOptions } from "./types.ts";

/**
 * Run install: optional archive extract → frozen gate → plan → policy gate →
 * download → orphan cleanup → primitives → targets → MCP trust/configure →
 * write deployed_file_hashes / mcp_* lock fields.
 *
 * With `dryRun: true`, returns after direct-deps (+ MCP view) preview and optional
 * policy preflight — no durable project writes and no target write ports.
 */
export async function runInstall(options: RunInstallOptions = {}): Promise<InstallResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const frozen = options.frozen === true;
  const dryRun = options.dryRun === true;
  const updateRefs = options.updateRefs === true || options.update === true;
  const forcedTargetId = options.forcedTarget ?? options.forceTarget;
  const configTargetId = options.configTarget?.trim() || undefined;
  const policyPath = options.policyPath ?? options.policy;
  const noPolicy = options.noPolicy === true;
  const noRepoPolicy = options.noRepoPolicy === true;
  const trustTransitiveMcp = options.trustTransitiveMcp === true;
  const trustBin = normalizeTrustBin(options.trustBin);
  const packageRefs = normalizePackageRefs(options.packageRefs);
  const excludeIds = normalizeExcludeIds(options);
  const excludeSet = new Set(excludeIds);
  const only = normalizeOnlyMode(options.only);
  const scope = options.scope === "global" ? "global" : "project";
  if (scope === "global" && only !== "mcp") {
    throw new InstallError(
      "INSTALL_GLOBAL_UNSUPPORTED",
      "Global install currently supports MCP only (--only mcp); global skills, rules, and compile are the next slice.",
      { details: { scope, only: only ?? "both" } },
    );
  }
  const skipApmMaterialize = only === "mcp";
  const skipMcpConfigure = only === "apm";
  // Accepted for CLI parity; must not refresh refs / bypass frozen / disable policy.
  void options.force;
  const allowInsecure = options.allowInsecure === true;
  const allowInsecureHosts = options.allowInsecureHosts;
  const dev = options.dev === true;
  const registry = (options.integrationRegistry ?? options.registry) as
    | IntegrationRegistry
    | undefined;

  const policyPorts = {
    policyProviders: options.policyProviders ?? options.providers,
    providers: options.providers ?? options.policyProviders,
    listGitRemotes: options.listGitRemotes,
    remotes: options.remotes,
    fetchPolicyUrl: options.fetchPolicyUrl,
    httpGet: options.httpGet,
    fetchAncestor: options.fetchAncestor,
    defaultFetchFailure: options.defaultFetchFailure,
    implementationDefaultHost: options.implementationDefaultHost,
  };

  if (options.archivePath && packageRefs.length > 0) {
    throw new InstallError(
      "INSTALL_PACKAGE_REF",
      "Cannot combine archive zip install with positional package refs",
      { details: { archivePath: options.archivePath, packageRefs } },
    );
  }

  if (packageRefs.length > 0 && frozen && !dryRun) {
    throw new InstallError(
      "INSTALL_FROZEN_POSITIONAL",
      "Frozen mode rejects positional package-ref add (manifest mutation)",
      { details: { frozen: true, packageRefs } },
    );
  }

  // Validate package refs early (also for dry-run preview)
  for (const ref of packageRefs) {
    packageRefToEntry(ref);
  }
  // G5: marketplace positional miss must fail before manifest mutation
  if (packageRefs.length > 0) {
    await assertMarketplacePackageRefsResolvable(packageRefs, {
      configDir: options.configDir ?? options.marketplaceConfigDir,
      marketplaceConfigDir: options.marketplaceConfigDir ?? options.configDir,
    });
  }

  if (options.archivePath && !dryRun) {
    await extractArchiveIntoProject(options.archivePath, cwd);
  }

  if (frozen && !dryRun) {
    enforceFrozen({ cwd, updateRefs, update: options.update });
  }

  if (packageRefs.length > 0 && !dryRun) {
    if (!manifestExistsAt(cwd)) {
      autoCreateMinimalManifest(cwd);
    }
    const loaded = loadManifest({ cwd });
    writeManifestWithPackageRefs({
      cwd,
      document: loaded.document,
      sourcePath: loaded.sourcePath,
      sourceFilename: loaded.sourceFilename,
      refs: packageRefs,
      dev,
    });
  }

  if (dryRun) {
    return runDryRunPreview({
      cwd,
      packageRefs,
      dev,
      allowInsecure,
      allowInsecureHosts,
      policyPath,
      noPolicy,
      noRepoPolicy,
      policyPorts,
      activeTargets: [],
    });
  }

  const { document: loadedRoot, warnings: rootManifestWarnings } = loadManifest({ cwd });
  const manifestWarningDiagnostics = (rootManifestWarnings ?? []).map((warning) => ({
    code: warning.code,
    message: warning.message,
    ...(warning.path !== undefined ? { path: warning.path } : {}),
    warn: true,
  }));
  // Preset expansion for deps; host selection uses resolved target ids only.
  const rootManifest = withEffectiveDirectDeps(loadedRoot);
  const { targetIds: resolvedTargetIds } = resolveActive(loadedRoot);
  const previousLock = loadEffectiveLockfileOrNull({ cwd });

  const insecureGate = gateInsecureBeforeFetch({
    cwd,
    document: rootManifest,
    allowInsecure,
    allowInsecureHosts,
  });
  const insecureDiagnostics = insecureGate.warnings.map((message) => ({
    code: "INSECURE_HTTP",
    message,
    warn: true,
  }));

  let lockPath: string | undefined;
  let nodes: ResolvedNode[] = [];
  let lockDocument: LockfileDocument | undefined;
  let policyDiagnostics: unknown[] = [];
  /**
   * Frozen package materialization is deferred until after the under-record gate
   * so a lock that cannot prove the would-be deploy set fails before local
   * package copies (and before any lock/harness mutation).
   */
  let frozenPackages: DownloadPackageSpec[] | undefined;

  const ports = {
    gitRemote: options.gitRemote,
    tagLister: options.tagLister,
    downloader: options.downloader,
    experimentalRegistries: options.experimentalRegistries,
    registryBaseUrl: options.registryBaseUrl,
    mirrorUrl: options.mirrorUrl,
  };

  if (!skipApmMaterialize) {
    if (frozen) {
      const loaded = previousLock;
      const graph = await resolveDependencyGraph({
        cwd,
        updateRefs: false,
        maxDepth: options.maxDepth,
        existingLock: loaded?.document ?? null,
        skipDownload: true,
        ...ports,
      });
      nodes = graph.nodes;
      ensureLocalSourcesUntracked({ projectRoot: cwd, manifest: rootManifest });
      policyDiagnostics = applyPolicyGate({
        cwd,
        policyPath,
        noPolicy,
        noRepoPolicy,
        nodes,
        ...policyPorts,
      });
      const packages = nodes
        .filter((n) => n.kind === "git-literal" || n.kind === "git-semver" || n.kind === "local")
        .map((n) => ({
          repoUrl: n.kind === "local" ? undefined : (n.gitUrl ?? restoreGitUrl(n.repo_url)),
          path: n.path,
          commit: n.resolved_commit,
          identity: n.identity,
          name: n.name,
        }));
      frozenPackages = packages;
      await materializeRegistryNodes(nodes, {
        cwd,
        mirrorUrl: options.mirrorUrl,
        registryBaseUrl: options.registryBaseUrl,
      });
      lockPath = loaded?.sourcePath;
      lockDocument = loaded?.document;

      // lk-017 lite: re-verify deployed_file_hashes when present (before harness mutation)
      if (lockDocument) {
        verifyDeployedFileHashes({ cwd, document: lockDocument });
        // lk-015: re-verify git tree_sha256 fail-closed
        verifyTreeSha256OrThrow({ cwd, document: lockDocument });
      }
    } else {
      const result = await resolveAndLock({
        cwd,
        updateRefs,
        parallelDownloads: options.parallelDownloads,
        maxDepth: options.maxDepth,
        verbose: options.verbose,
        policyPath,
        policy: policyPath,
        noPolicy,
        noRepoPolicy,
        marketplaceConfigDir: options.marketplaceConfigDir ?? options.configDir,
        configDir: options.configDir ?? options.marketplaceConfigDir,
        ...ports,
        ...policyPorts,
      });
      lockPath = result.lockPath;
      nodes = result.nodes;
      policyDiagnostics = result.policyDiagnostics ?? [];
      const reloaded = loadEffectiveLockfileOrNull({ cwd });
      lockDocument = reloaded?.document;
      if (reloaded) {
        lockPath = reloaded.sourcePath;
      }
    }
  } else {
    // only=mcp: skip APM download/materialize; still apply policy on declared names when possible
    policyDiagnostics = applyPolicyGate({
      cwd,
      policyPath,
      noPolicy,
      noRepoPolicy,
      nodes: [],
      candidatesOverride: extractDeclarationOrder(rootManifest).map((name) => ({
        id: name,
        name,
        ref: name,
        direct: true,
        depth: 1,
      })),
      ...policyPorts,
    });
    lockPath = previousLock?.sourcePath;
    lockDocument = previousLock?.document;
  }

  const currentDepNames = new Set(nodes.map((n) => n.name).filter(Boolean));

  // `lifecycle:` is retained by the manifest parser but never executed. Surface
  // one warning per declaring package (root and dependency packages).
  const lifecycleDiagnostics = detectLifecycleUnsupported({
    rootManifest,
    nodes: skipApmMaterialize ? [] : nodes,
  });

  if (!frozen && !skipApmMaterialize) {
    cleanupOrphanDeployedFiles({
      cwd,
      previous: previousLock?.document,
      currentDepNames,
    });
  }

  const declarationOrder =
    nodes.length > 0
      ? uniqueNames(nodes.filter((n) => n.depth === 1).map((n) => n.name))
      : extractDeclarationOrder(rootManifest);

  const nativeRaw = skipApmMaterialize
    ? []
    : discoverPrimitives({
        cwd,
        modulesDir: join(cwd, APM_MODULES_DIR),
        packageRoots: nodes
          .map((node) => node.packageRoot)
          .filter((root): root is string => typeof root === "string" && root.length > 0),
        declarationOrder,
      });
  const raw = nativeRaw.filter(
    (primitive) => !nodes.some((node) => isPortablePluginPrimitive(node, primitive.path)),
  );
  const portablePluginDiagnostics: unknown[] = [];
  if (!skipApmMaterialize) {
    try {
      const portable = discoverPortablePluginPrimitives(nodes);
      raw.push(...portable.primitives);
      portablePluginDiagnostics.push(...portable.diagnostics);
    } catch (error) {
      // Declared Agent Plugins paths/skills are requirements: fail closed before
      // deploy and do not leave a freshly written lock from this install.
      const code =
        error instanceof AgentPluginsError
          ? error.code
          : error && typeof error === "object" && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
      if (
        code === "AGENT_PLUGIN_DECLARED_PATH_INVALID" ||
        code === "AGENT_PLUGIN_SKILL_DECLARED_INVALID" ||
        code === "AGENT_PLUGIN_MANIFEST_INVALID"
      ) {
        rollbackFreshLock({ previousLock, lockPath, cwd });
      }
      throw error;
    }
  }
  const resolved = skipApmMaterialize
    ? { primitives: [] as AttributedPrimitive[], diagnostics: [] as unknown[] }
    : resolvePrimitiveConflicts({
        primitives: raw,
        declarationOrder,
      });

  // `dependencies.lsp` and canvas declarations are retained by the manifest
  // parser but have no deploy path. Surface them explicitly instead of silently
  // dropping; canvas stays outside the executable trust gates.
  const unsupportedDiagnostics = detectUnsupportedDeclarations({
    rootManifest,
    nodes: skipApmMaterialize ? [] : nodes,
    primitives: resolved.primitives,
  });

  // Frozen must not deploy primitives that the lock does not record, and local
  // snapshots must be re-verified before target materialize / lock writes.
  if (frozen && !skipApmMaterialize && lockDocument) {
    assertFrozenDeployInventory({
      cwd,
      document: lockDocument,
      nodes,
      primitives: resolved.primitives,
    });
  }

  // Deferred frozen package copy (local modules) runs only after the gate.
  if (frozenPackages) {
    await downloadPackages({
      cwd,
      packages: frozenPackages,
      parallelDownloads: options.parallelDownloads ?? DEFAULT_PARALLEL_DOWNLOADS,
      downloader: options.downloader,
    });
    frozenPackages = undefined;
  }

  // Resolve target state only after independent preconditions (manifest,
  // frozen, resolution, and policy) pass, but before target harness writes.
  assertForcedTargetRegistered(forcedTargetId, registry);
  assertRegisteredExcludeIds(excludeIds, registry);
  const activeTargets = await resolveActiveTargets({
    cwd,
    registry,
    override: options.activeTargets,
    forcedTargetId,
    manifestActive: resolvedTargetIds,
    configTargetId,
    scope,
  });
  assertActiveTargetsRegistered(activeTargets, registry);
  if (scope === "global") {
    assertGlobalMcpSupported(activeTargets, registry, excludeSet);
  }

  // Root `target` / `targets` is a deployment allow-list (tg-008), not active
  // selection. Fail closed when it excludes every active host; otherwise warn
  // for each filtered host instead of silently materializing nothing.
  const targetSelectionDiagnostics: unknown[] = [];
  const rootDeclaredTargets = declaredTargetIds(rootManifest);
  if (rootDeclaredTargets.length > 0) {
    const declaredSet = new Set(rootDeclaredTargets);
    const skippedActiveTargets = activeTargets.filter((id) => !declaredSet.has(id));
    if (skippedActiveTargets.length === activeTargets.length) {
      rollbackFreshLock({ previousLock, lockPath, cwd });
      throw new InstallError(
        "INSTALL_TARGETS_EMPTY_INTERSECTION",
        `No active target is declared in the root target/targets: active=[${activeTargets.join(
          ", ",
        )}], declared=[${rootDeclaredTargets.join(
          ", ",
        )}]. Remove target/targets or add the active host to it.`,
        {
          details: {
            activeTargets: [...activeTargets],
            declaredTargets: [...rootDeclaredTargets],
          },
        },
      );
    }
    if (skippedActiveTargets.length > 0) {
      targetSelectionDiagnostics.push({
        code: "INSTALL_TARGET_SKIPPED_BY_TARGETS",
        message: `Active target(s) ${skippedActiveTargets.join(
          ", ",
        )} are not declared in the root target/targets [${rootDeclaredTargets.join(
          ", ",
        )}]; their package primitives will be skipped. Add them to target/targets or remove the restriction.`,
        warn: true,
        skippedTargets: [...skippedActiveTargets],
        declaredTargets: [...rootDeclaredTargets],
      });
    }
  }

  const copilotActive = activeTargets.includes("copilot");
  let admittedNativePackages = new Set<string>();
  let admittedNativePlugins: ReturnType<typeof admitCopilotNativePlugins> = [];

  if (copilotActive && !skipApmMaterialize) {
    try {
      admittedNativePlugins = admitCopilotNativePlugins(nodes, { cwd });
      admittedNativePackages = new Set(admittedNativePlugins.map((p) => p.packageName));
    } catch (error) {
      rollbackFreshLock({ previousLock, lockPath, cwd });
      throw error;
    }
  }

  const installTrustContext = resolveInstallTrustContext({
    cwd,
    rootManifest,
    configDir: options.configDir ?? options.marketplaceConfigDir,
    policyPath,
    noPolicy,
    noRepoPolicy,
    policyPorts,
  });

  const allDeployed: ReturnType<typeof collectDeployedHashes> = [];
  const materializedPrimitives: AttributedPrimitive[] = [];
  const subsetDiagnostics: unknown[] = [];
  const materializeDiagnostics: unknown[] = [];
  const hookTrustDiagnostics: unknown[] = [];

  if (!skipApmMaterialize && registry && activeTargets.length > 0) {
    const packageTargets = collectPackageDeclaredTargets(nodes, raw);
    const afterSkillFilter = applySkillSubsets(resolved.primitives, nodes, subsetDiagnostics);
    const afterHookTrust = gateDependencyHooksWithTrust(afterSkillFilter, installTrustContext);
    hookTrustDiagnostics.push(...afterHookTrust.diagnostics);
    for (const targetId of activeTargets) {
      const target = findTarget(registry, targetId);
      if (!target) continue;

      let filtered = filterByIntersection(
        afterHookTrust.primitives,
        targetId,
        packageTargets,
        rootManifest,
        nodes,
      );
      if (targetId === "copilot" && admittedNativePackages.size > 0) {
        filtered = filterPrimitivesForCopilotNative(filtered, admittedNativePackages);
      }
      materializedPrimitives.push(...filtered);
      const report = (await target.materialize(filtered, {
        cwd,
        targetId,
        deployRoots: [...target.deployRoots],
        scope,
        skipNativeRegisteredPackages: [...admittedNativePackages],
      })) as void | MaterializeReport;
      // Adapter skip diagnostics must reach the install result (and CLI), not
      // just the per-target report. Normalize visibility before deployment
      // hashes so result inspection can distinguish skipped primitives.
      for (const diagnostic of report?.diagnostics ?? []) {
        materializeDiagnostics.push(markSkipDiagnosticWarn(diagnostic));
      }
      allDeployed.push(...collectTargetDeployedHashes(cwd, target, report));
    }
  }

  if (copilotActive && !skipApmMaterialize) {
    try {
      rebuildCopilotNativeRegistration({
        cwd,
        admitted: admittedNativePlugins,
        dryRun: false,
      });
    } catch (error) {
      rollbackFreshLock({ previousLock, lockPath, cwd });
      throw error;
    }
  }

  if (!frozen && !skipApmMaterialize && lockDocument && allDeployed.length > 0) {
    const wrote = applyDeployedHashesToLock({
      document: lockDocument,
      deployed: allDeployed,
      primitives: materializedPrimitives.length > 0 ? materializedPrimitives : resolved.primitives,
    });
    if (wrote) {
      lockPath = partitionAndWriteLockfiles(lockDocument, {
        cwd,
        sourcePath: lockPath,
        sourceFilename: previousLock?.sourceFilename,
      }).sharedPath;
    }
  }

  const binDiagnostics: unknown[] = [];
  if (!skipApmMaterialize) {
    binDiagnostics.push(
      ...deployBinsAfterConsent({
        cwd,
        rootManifest,
        nodes,
        trustBin,
        frozen,
        isInteractive: options.isInteractive,
        env: options.env,
        stdinIsTTY: options.stdinIsTTY,
        binDeployRoot: options.binDeployRoot,
        configDir: options.configDir ?? options.marketplaceConfigDir,
        policyPath,
        noPolicy,
        noRepoPolicy,
        policyPorts,
        trustContext: installTrustContext,
      }),
    );
  }

  const mcpDiagnostics: unknown[] = [];
  if (!skipMcpConfigure) {
    const mcpResult = await deployMcpAfterPolicy({
      cwd,
      rootManifest,
      nodes,
      registry,
      activeTargets,
      only,
      trustTransitiveMcp,
      frozen,
      excludeSet,
      lockDocument,
      lockPath,
      previousLockFilename: previousLock?.sourceFilename,
      diagnostics: mcpDiagnostics,
      configDir: options.configDir ?? options.marketplaceConfigDir,
      policyPath,
      noPolicy,
      noRepoPolicy,
      policyPorts,
      trustContext: installTrustContext,
      env: options.env,
      mcpRegistry: options.mcpRegistry,
      scope,
    });
    if (mcpResult.lockPath) lockPath = mcpResult.lockPath;
    if (mcpResult.lockDocument) lockDocument = mcpResult.lockDocument;

    if (mcpResult.withholdFatal) {
      throw new InstallError(
        "INSTALL_MCP_TRUST",
        mcpResult.withholdMessage ??
          "MCP withheld: explicitly denied or unapproved dependency executables (sc-009)",
        { details: { withheld: mcpResult.withheldPackages } },
      );
    }
  }

  return {
    ok: true,
    lockPath,
    modulesDir: join(cwd, APM_MODULES_DIR),
    activeTargets,
    primitivesCount: resolved.primitives.length,
    diagnostics: [
      ...manifestWarningDiagnostics,
      ...lifecycleDiagnostics,
      ...unsupportedDiagnostics,
      ...insecureDiagnostics,
      ...policyDiagnostics,
      ...resolved.diagnostics,
      ...portablePluginDiagnostics,
      ...subsetDiagnostics,
      ...targetSelectionDiagnostics,
      ...hookTrustDiagnostics,
      ...materializeDiagnostics,
      ...binDiagnostics,
      ...mcpDiagnostics,
    ],
    policyDiagnostics,
  };
}

/**
 * Portable plugins are discovered only from resolver-materialized package roots.
 * The resolver remains the sole source of local/git/registry provenance.
 */
function discoverPortablePluginPrimitives(nodes: ResolvedNode[]): {
  primitives: AttributedPrimitive[];
  diagnostics: unknown[];
} {
  const primitives: AttributedPrimitive[] = [];
  const diagnostics: unknown[] = [];
  for (const node of nodes) {
    const root = portablePluginRoot(node);
    if (!root) continue;
    const discovered = discoverAgentPluginSkills({ root, packageName: node.name });
    diagnostics.push(...discovered.diagnostics);
    for (const skill of discovered.skills) {
      primitives.push({
        name: skill.name,
        type: "skill",
        source: `dependency:${node.name}`,
        packageName: node.name,
        path: skill.skillPath,
        skillDirectory: skill.directory,
        pluginRoot: discovered.root,
        format: "agent-plugin",
      });
    }
    const declared = discoverAgentPluginDeclaredPaths({ root, packageName: node.name });
    diagnostics.push(...declared.diagnostics);
    for (const item of [...declared.commands, ...declared.hooks]) {
      primitives.push({
        name: item.name,
        type: item.type,
        source: `dependency:${node.name}`,
        packageName: node.name,
        path: item.path,
        pluginRoot: declared.root,
        format: "agent-plugin",
      });
    }
  }
  return { primitives, diagnostics };
}

function isPortablePluginPrimitive(node: ResolvedNode, primitivePath: string): boolean {
  const root = portablePluginRoot(node);
  if (!root) return false;
  const rel = relative(resolve(root), resolve(primitivePath));
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}

function portablePluginRoot(node: ResolvedNode): string | undefined {
  for (const candidate of [node.packageRoot, node.path]) {
    if (candidate && existsSync(join(candidate, "plugin.json"))) return candidate;
  }
  return undefined;
}

/**
 * Adapter diagnostics for unsupported/skipped primitives are user-visible
 * warnings. Keep the adapter payload intact while normalizing `warn` so the
 * CLI generic warning emitter can surface it.
 */
function markSkipDiagnosticWarn(diagnostic: unknown): unknown {
  if (!diagnostic || typeof diagnostic !== "object") return diagnostic;
  const rec = diagnostic as Record<string, unknown>;
  if (rec.warn === true) return rec;
  const code = typeof rec.code === "string" ? rec.code.toUpperCase() : "";
  if (!/_UNSUPPORTED(?:$|_)|_SKIP_|_MCP_SKIP_NO_/.test(code)) return diagnostic;
  return { ...rec, warn: true };
}

/**
 * Home-scoped MCP is a host contract (Copilot/Windsurf), but it writes a file
 * shared by every project. Prefer the declared `mcpScope`; the canonical ids
 * are a fallback for older/injected registries that omit the optional field.
 */
const HOME_SCOPED_MCP_TARGET_IDS = new Set(["copilot", "windsurf"]);

function isHomeScopedMcpTarget(target: BapmIntegration): boolean {
  if (target.mcpScope === "home") return true;
  return HOME_SCOPED_MCP_TARGET_IDS.has(String(target.id ?? "").toLowerCase());
}

function isEnvFlagEnabled(
  env: Record<string, string | undefined> | undefined,
  key: string,
): boolean {
  const value = (env?.[key] ?? process.env[key])?.trim().toLowerCase();
  return value === "1" || value === "true";
}

/** Best-effort: drop a lock written by this install when a later gate fails closed. */
function rollbackFreshLock(args: {
  previousLock: ReturnType<typeof loadEffectiveLockfileOrNull>;
  lockPath?: string;
  cwd: string;
}): void {
  if (args.previousLock) return;
  if (args.lockPath && existsSync(args.lockPath)) {
    try {
      unlinkSync(args.lockPath);
    } catch {
      /* best-effort */
    }
  }
  for (const name of ["bapm.lock.yaml", "apm.lock.yaml"]) {
    const candidate = join(args.cwd, name);
    if (existsSync(candidate)) {
      try {
        unlinkSync(candidate);
      } catch {
        /* best-effort */
      }
    }
  }
}

function normalizeOnlyMode(only: InstallOnlyMode | undefined): InstallOnlyMode | undefined {
  if (only === undefined || only === null) return undefined;
  if (only === "apm" || only === "mcp") return only;
  throw new InstallError(
    "INSTALL_FAILED",
    `Invalid only mode: ${String(only)} (expected "apm" or "mcp")`,
    { details: { only } },
  );
}

async function runDryRunPreview(args: {
  cwd: string;
  packageRefs: string[];
  dev?: boolean;
  allowInsecure?: boolean;
  allowInsecureHosts?: string[];
  policyPath?: string;
  noPolicy: boolean;
  noRepoPolicy?: boolean;
  policyPorts: {
    policyProviders?: string[];
    providers?: string[];
    listGitRemotes?: RunInstallOptions["listGitRemotes"];
    remotes?: RunInstallOptions["remotes"];
    fetchPolicyUrl?: RunInstallOptions["fetchPolicyUrl"];
    httpGet?: RunInstallOptions["httpGet"];
    fetchAncestor?: RunInstallOptions["fetchAncestor"];
    defaultFetchFailure?: RunInstallOptions["defaultFetchFailure"];
    implementationDefaultHost?: string;
  };
  activeTargets: string[];
}): Promise<InstallResult> {
  // Validate host tokens even on dry-run (fail-closed).
  if (args.allowInsecureHosts && args.allowInsecureHosts.length > 0) {
    normalizeAllowInsecureHosts(args.allowInsecureHosts);
  }

  const diagnostics: unknown[] = [
    {
      code: "DRY_RUN",
      message: "dry-run preview; no changes made",
      dryRun: true,
      preview: true,
    },
  ];

  let rootManifest: BapmManifest | undefined;
  if (manifestExistsAt(args.cwd)) {
    const loaded = loadManifest({ cwd: args.cwd });
    rootManifest = loaded.document;
    for (const warning of loaded.warnings ?? []) {
      diagnostics.push({
        code: warning.code,
        message: warning.message,
        ...(warning.path !== undefined ? { path: warning.path } : {}),
        warn: true,
      });
    }
  } else if (args.packageRefs.length === 0) {
    // Preserve bare-install fail-closed (no auto-create without positional).
    loadManifest({ cwd: args.cwd });
  }

  if (args.packageRefs.length > 0) {
    const section = args.dev ? "devDependencies.apm" : "dependencies.apm";
    diagnostics.push({
      code: "DRY_RUN_WOULD_ADD",
      message: `would add package refs under ${section}: ${args.packageRefs.join(", ")}`,
      wouldAdd: args.packageRefs,
      wouldAddSection: section,
      preview: true,
      dryRun: true,
    });
  }

  const directApm = [
    ...(rootManifest?.dependencies?.apm ?? []),
    ...(rootManifest?.devDependencies?.apm ?? []),
  ];
  const directPreview = directApm.map((entry) => summarizeDirectEntry(entry));
  for (const ref of args.packageRefs) {
    if (!directPreview.includes(ref)) directPreview.push(ref);
  }
  diagnostics.push({
    code: "DRY_RUN_DIRECT_DEPS",
    message: `would install direct dependencies: ${directPreview.join(", ") || "(none)"}`,
    directDependencies: directPreview,
    preview: true,
    dryRun: true,
  });

  const mcpDeps = rootManifest?.dependencies?.mcp;
  if (Array.isArray(mcpDeps) && mcpDeps.length > 0) {
    diagnostics.push({
      code: "DRY_RUN_MCP_VIEW",
      message: `MCP deps view: ${mcpDeps.length} direct server(s)`,
      mcpCount: mcpDeps.length,
      preview: true,
      dryRun: true,
    });
  }

  // Optional policy preflight on direct set only (no full resolve/download).
  let policyDiagnostics: unknown[] = [];
  if (!args.noPolicy) {
    const candidates: PolicyCandidate[] = [];
    for (const entry of directApm) {
      const hint = entryNameHint(entry) ?? summarizeDirectEntry(entry);
      candidates.push({
        id: hint,
        name: hint,
        ref: summarizeDirectEntry(entry),
        direct: true,
        depth: 1,
        path:
          typeof entry === "object" && entry && "path" in entry
            ? String((entry as ObjectDependency).path)
            : undefined,
        source: typeof entry === "object" && entry && "path" in entry ? "local" : undefined,
      });
    }
    for (const ref of args.packageRefs) {
      candidates.push({
        id: ref,
        name: ref,
        ref,
        direct: true,
        depth: 1,
      });
    }
    if (candidates.length > 0 || args.policyPath) {
      policyDiagnostics = applyPolicyGate({
        cwd: args.cwd,
        policyPath: args.policyPath,
        noPolicy: args.noPolicy,
        noRepoPolicy: args.noRepoPolicy,
        nodes: [],
        candidatesOverride: candidates,
        ...args.policyPorts,
      });
    }
  }

  return {
    ok: true,
    modulesDir: join(args.cwd, APM_MODULES_DIR),
    activeTargets: args.activeTargets,
    primitivesCount: 0,
    diagnostics: [
      ...(rootManifest ? detectLifecycleUnsupported({ rootManifest }) : []),
      ...(rootManifest ? detectUnsupportedDeclarations({ rootManifest }) : []),
      ...policyDiagnostics,
      ...diagnostics,
    ],
    policyDiagnostics,
    dryRun: true,
  };
}

function summarizeDirectEntry(entry: DependencyEntry): string {
  if (typeof entry === "string") return entry;
  const o = entry as ObjectDependency;
  if (o.path) return String(o.path);
  if (o.git) return String(o.git);
  if (o.id) return String(o.id);
  if (o.alias) return String(o.alias);
  return entryNameHint(entry) ?? "(dep)";
}

type InstallTrustContext = {
  projectSurface: ExecutableGrantSurface;
  userSurface: ExecutableGrantSurface;
  combinedSurface: ExecutableGrantSurface;
  orgExecutables: PolicyExecutables;
};

type InstallTrustContextArgs = {
  cwd: string;
  rootManifest: BapmManifest;
  configDir?: string;
  policyPath?: string;
  noPolicy: boolean;
  noRepoPolicy?: boolean;
  policyPorts?: Parameters<typeof loadOrgExecutablesForTrust>[0]["policyPorts"];
};

/**
 * Load the effective executable-trust inputs once per install so hooks, bin,
 * and MCP share identical project/user/org policy (no duplicated policy logic).
 */
function resolveInstallTrustContext(args: InstallTrustContextArgs): InstallTrustContext {
  const projectSurface = parseExecutableGrants({
    manifest: args.rootManifest as Record<string, unknown>,
  });
  const userLoaded = loadUserExecutableGrants({
    configDir: args.configDir,
    configRoot: args.configDir,
  });
  const userSurface = userGrantsToSurface(userLoaded);
  const combinedSurface: ExecutableGrantSurface = {
    present: projectSurface.present || userSurface.present,
    allow: { ...projectSurface.allow, ...userSurface.allow },
    deny: { ...projectSurface.deny, ...userSurface.deny },
  };
  return {
    projectSurface,
    userSurface,
    combinedSurface,
    orgExecutables: loadOrgExecutablesForTrust({
      cwd: args.cwd,
      policyPath: args.policyPath,
      noPolicy: args.noPolicy,
      noRepoPolicy: args.noRepoPolicy === true,
      policyPorts: args.policyPorts,
    }),
  };
}

/**
 * Gate dependency hooks through ExecutableTrust (type `hook`) before any target
 * materializes them. Root/local hooks (`source: "local"`) are never gated, and
 * with no grant surface and no org deny the resolver returns `skip` (legacy
 * soft behavior: dependency hooks deploy).
 */
function gateDependencyHooksWithTrust(
  primitives: AttributedPrimitive[],
  trust: InstallTrustContext,
): { primitives: AttributedPrimitive[]; diagnostics: unknown[] } {
  const kept: AttributedPrimitive[] = [];
  const diagnostics: unknown[] = [];
  for (const primitive of primitives) {
    if (primitive.type !== "hook" || !primitive.source.startsWith("dependency:")) {
      kept.push(primitive);
      continue;
    }
    const packageName =
      primitive.packageName?.trim() || primitive.source.slice("dependency:".length);
    const decision = resolveExecutableTrust({
      packageName,
      executableType: "hook",
      orgExecutables: trust.orgExecutables,
      projectSurface: trust.projectSurface,
      userSurface: trust.userSurface,
      grantSurface: trust.combinedSurface,
    });
    if (decision.allowed) {
      kept.push(primitive);
      continue;
    }
    diagnostics.push({
      code: "HOOK_TRUST_WITHHELD",
      message: `hook "${primitive.name}" from dependency "${packageName}" withheld: ${
        decision.reason ?? `ExecutableTrust ${decision.outcome}`
      }`,
      warn: true,
      packageName,
      hook: primitive.name,
      path: primitive.path,
      withhold: true,
      unapproved: true,
      outcome: decision.outcome,
    });
  }
  return { primitives: kept, diagnostics };
}

function isRegistryOnlyMcpServer(server: CollectedMcpServer): boolean {
  const registry = server.registry;
  // `registry: false` means self-defined (fully described here). Absent also
  // means no lookup in bapm's current model. True/string request a registry.
  const requestsLookup =
    registry !== undefined &&
    registry !== null &&
    registry !== false &&
    !(typeof registry === "string" && registry.trim().length === 0);
  if (!requestsLookup) return false;
  const hasCommand = typeof server.command === "string" && server.command.trim().length > 0;
  const hasUrl = typeof server.url === "string" && server.url.trim().length > 0;
  return !hasCommand && !hasUrl;
}

function registryUrlForDeclaration(registry: unknown): { registryUrl: string } | undefined {
  if (typeof registry === "string" && registry.trim().length > 0) {
    return { registryUrl: registry.trim() };
  }
  if (registry && typeof registry === "object" && !Array.isArray(registry)) {
    const url = (registry as { url?: unknown }).url;
    if (typeof url === "string" && url.trim().length > 0) {
      return { registryUrl: url.trim() };
    }
  }
  return undefined;
}

function registryUnsupportedError(servers: CollectedMcpServer[], cause?: unknown): InstallError {
  const names = servers.map((server) => server.name).join(", ");
  const hint =
    `declare "command" for stdio or "url" for http/streamable-http (and set registry: false), ` +
    `or inspect the server with \`bapm mcp show ${servers[0]?.name ?? "<name>"}\` / ` +
    `\`bapm mcp install ${servers[0]?.name ?? "<name>"} --dry-run\``;
  return new InstallError(
    "MCP_REGISTRY_UNSUPPORTED",
    `MCP server${servers.length === 1 ? "" : "s"} ${names} could not be resolved from an MCP registry; ${hint}`,
    {
      ...(cause !== undefined ? { cause } : {}),
      details: {
        servers: servers.map((server) => ({
          name: server.name,
          packageName: server.packageName,
          origin: server.origin,
          registry: server.registry,
        })),
      },
    },
  );
}

async function deployMcpAfterPolicy(args: {
  cwd: string;
  rootManifest: BapmManifest;
  nodes: ResolvedNode[];
  registry?: IntegrationRegistry;
  activeTargets: string[];
  /** Explicit `install --only` surface; MCP-only reconciliation must not assume nodes. */
  only?: InstallOnlyMode;
  forcedTargetId?: string;
  trustTransitiveMcp: boolean;
  frozen: boolean;
  excludeSet: Set<string>;
  lockDocument?: LockfileDocument;
  lockPath?: string;
  previousLockFilename?: string;
  diagnostics: unknown[];
  configDir?: string;
  policyPath?: string;
  noPolicy?: boolean;
  noRepoPolicy?: boolean;
  policyPorts?: {
    policyProviders?: string[];
    providers?: string[];
    listGitRemotes?: RunInstallOptions["listGitRemotes"];
    remotes?: RunInstallOptions["remotes"];
    fetchPolicyUrl?: RunInstallOptions["fetchPolicyUrl"];
    httpGet?: RunInstallOptions["httpGet"];
    fetchAncestor?: RunInstallOptions["fetchAncestor"];
    defaultFetchFailure?: RunInstallOptions["defaultFetchFailure"];
    implementationDefaultHost?: string;
  };
  trustContext?: InstallTrustContext;
  /** Env overlay; `BAPM_NO_GLOBAL_MCP` skips home-scoped MCP configure when truthy. */
  env?: Record<string, string | undefined>;
  mcpRegistry?: McpRegistryLookup;
  /** Project (default) or user-global configure path selection. */
  scope?: DeploymentScope;
}): Promise<{
  lockPath?: string;
  lockDocument?: LockfileDocument;
  withholdFatal: boolean;
  withholdMessage?: string;
  withheldPackages: string[];
}> {
  const { projectSurface, userSurface, combinedSurface, orgExecutables } =
    args.trustContext ??
    resolveInstallTrustContext({
      cwd: args.cwd,
      rootManifest: args.rootManifest,
      configDir: args.configDir,
      policyPath: args.policyPath,
      noPolicy: args.noPolicy === true,
      noRepoPolicy: args.noRepoPolicy === true,
      policyPorts: args.policyPorts,
    });

  const collected = collectMcpServers({
    cwd: args.cwd,
    rootManifest: args.rootManifest,
    nodes: args.nodes,
    trustTransitiveMcp: args.trustTransitiveMcp,
    grantSurface: combinedSurface,
  });
  args.diagnostics.push(...collected.diagnostics);

  const rootName = String(args.rootManifest.name ?? "root");

  // Records written by this target in the previous lock let a configure pass
  // remove entries bapm owns without touching foreign host servers. Compute
  // this before the empty-collection fast path: an MCP-only cleanup pass after
  // `deny` collects no dependency servers but must still prune host configs.
  if (collected.servers.length === 0) {
    const pruneByTarget = resolveMcpPruneInventory({
      document: args.lockDocument,
      activeTargets: args.activeTargets,
      approved: [],
      only: args.only,
      rootName,
      orgExecutables,
      projectSurface,
      userSurface,
      diagnostics: args.diagnostics,
    });
    await pruneTargetMcpConfigs({
      cwd: args.cwd,
      registry: args.registry,
      activeTargets: args.activeTargets,
      excludeSet: args.excludeSet,
      pruneByTarget,
      diagnostics: args.diagnostics,
      scope: args.scope,
    });
    return {
      ...refreshMcpLockInventory({
        cwd: args.cwd,
        frozen: args.frozen,
        document: args.lockDocument,
        lockPath: args.lockPath,
        previousLockFilename: args.previousLockFilename,
        update: {
          kind: "prune",
          rootPackageName: rootName,
          ...(args.nodes.length > 0
            ? {
                livePackageNames: [...new Set(args.nodes.map((node) => node.name).filter(Boolean))],
              }
            : {}),
        },
      }),
      withholdFatal: false,
      withheldPackages: [],
    };
  }

  let approved: typeof collected.servers = [];
  const withheldPackages: string[] = [];
  const skippedPackages: string[] = [];

  for (const server of collected.servers) {
    if (server.origin === "direct" || server.packageName === rootName) {
      approved.push(server);
      continue;
    }
    const decision = resolveExecutableTrust({
      packageName: server.packageName,
      executableType: "mcp",
      orgExecutables,
      projectSurface,
      userSurface,
    });
    if (decision.outcome === "skip") {
      // No grant surface: only reach here for dep MCP when trust-transitive is on.
      approved.push(server);
      continue;
    }
    if (decision.allowed) {
      approved.push(server);
      continue;
    }

    // Explicit deny (project/user/org) and mentioned-but-unapproved entries
    // (e.g. `mcp: false` or another executable type only) stay fatal. A package
    // the surface never mentions is merely skipped with a warning: one grant
    // must not make every unrelated dependency MCP package fatal.
    const mentioned =
      decision.outcome === "deny" ||
      isPackageMentionedInGrants({
        packageName: server.packageName,
        projectSurface,
        userSurface,
        orgExecutables,
      });
    if (!mentioned) {
      if (!skippedPackages.includes(server.packageName)) {
        skippedPackages.push(server.packageName);
        args.diagnostics.push({
          code: "MCP_NOT_APPROVED",
          message: `MCP from dependency "${server.packageName}" skipped: not approved. Run "bapm approve ${server.packageName}" or add executables.allow.${server.packageName}.mcp: true to bapm.yml.`,
          warn: true,
          packageName: server.packageName,
          server: server.name,
          skip: true,
          unapproved: true,
          outcome: decision.outcome,
        });
      }
      continue;
    }

    withheldPackages.push(server.packageName);
    args.diagnostics.push({
      code: "MCP_TRUST_WITHHOLD",
      message: decision.reason ?? `unapproved MCP from "${server.packageName}" withheld`,
      packageName: server.packageName,
      server: server.name,
      withhold: true,
      unapproved: true,
      outcome: decision.outcome,
    });
  }

  const uniqueWithheld = [...new Set(withheldPackages)];
  // Non-empty only for explicit denies / org deny / mentioned-but-unapproved.
  const withholdFatal = uniqueWithheld.length > 0;
  const withholdMessage = withholdFatal
    ? `MCP withheld: explicitly denied or unapproved dependency executables (${uniqueWithheld.join(", ")}). Remove the deny or add to executables.allow / allowExecutables; otherwise remove MCP.`
    : undefined;

  // Resolve registry-only declarations through the injected MCP registry port.
  // Without a port (library callers/tests that did not opt in) keep the legacy
  // fail-closed behavior: fail before any host config or MCP lock inventory is
  // written so a `{type:"stdio"}` shell never reaches a host.
  const registryOnly = approved.filter(isRegistryOnlyMcpServer);
  if (registryOnly.length > 0) {
    if (!args.mcpRegistry) {
      throw registryUnsupportedError(registryOnly);
    }
    const resolvedByName = new Map<string, CollectedMcpServer>();
    for (const server of registryOnly) {
      try {
        const details = await args.mcpRegistry.getServer(
          server.name,
          registryUrlForDeclaration(server.registry),
        );
        const resolution = resolveMcpServerFromRegistry(details, {
          transport: server.transport,
          type: server.type,
          command: server.command,
          args: server.args,
          url: server.url,
          env: server.env,
          headers: server.headers,
        });
        args.diagnostics.push(...resolution.diagnostics);
        resolvedByName.set(server.name, {
          ...server,
          ...resolution.server,
          // The declaration name remains the stable host key.
          name: server.name,
          origin: server.origin,
          packageName: server.packageName,
          registry: false,
        });
      } catch (cause) {
        throw registryUnsupportedError([server], cause);
      }
    }
    approved = approved.map((server) => resolvedByName.get(server.name) ?? server);
  }

  // Records written by this target in the previous lock let a configure pass
  // remove entries bapm owns without touching foreign host servers.
  const pruneByTarget = resolveMcpPruneInventory({
    document: args.lockDocument,
    activeTargets: args.activeTargets,
    approved,
    only: args.only,
    rootName,
    orgExecutables,
    projectSurface,
    userSurface,
    diagnostics: args.diagnostics,
  });

  if (approved.length === 0) {
    await pruneTargetMcpConfigs({
      cwd: args.cwd,
      registry: args.registry,
      activeTargets: args.activeTargets,
      excludeSet: args.excludeSet,
      pruneByTarget,
      diagnostics: args.diagnostics,
      scope: args.scope,
    });
    return {
      ...refreshMcpLockInventory({
        cwd: args.cwd,
        frozen: args.frozen,
        document: args.lockDocument,
        lockPath: args.lockPath,
        previousLockFilename: args.previousLockFilename,
        update: { kind: "clear" },
      }),
      withholdFatal,
      withholdMessage,
      withheldPackages: uniqueWithheld,
    };
  }

  // Bapm—not package config—creates and owns portable PLUGIN_DATA directories.
  for (const server of approved) {
    if (server.format !== "agent-plugin" || !server.env?.PLUGIN_DATA) continue;
    mkdirSync(server.env.PLUGIN_DATA, { recursive: true, mode: 0o700 });
  }

  if (!args.registry || args.activeTargets.length === 0) {
    return {
      ...refreshMcpLockInventory({
        cwd: args.cwd,
        frozen: args.frozen,
        document: args.lockDocument,
        lockPath: args.lockPath,
        previousLockFilename: args.previousLockFilename,
        update: { kind: "declarations", servers: approved },
      }),
      withholdFatal,
      withholdMessage,
      withheldPackages: uniqueWithheld,
    };
  }

  const configuredTargets: Array<{ targetId: string; configPath: string }> = [];
  const warnedGlobalTargets = new Set<string>();

  for (const targetId of args.activeTargets) {
    const target = findTarget(args.registry, targetId);
    if (!target) continue;

    const configureMcp = getConfigureMcp(target);
    if (!configureMcp) continue;

    if (args.excludeSet.has(targetId)) {
      args.diagnostics.push({
        code: "EXCLUDE_SKIP_MCP",
        message: `Skipping configureMcp for excluded target "${targetId}" (MCP filter; install continues)`,
        exclude: targetId,
        warn: true,
      });
      continue;
    }

    const homeScopedMcp = isHomeScopedMcpTarget(target);
    if (homeScopedMcp && isEnvFlagEnabled(args.env, "BAPM_NO_GLOBAL_MCP")) {
      args.diagnostics.push({
        code: "MCP_GLOBAL_CONFIG_SKIPPED",
        message: `Skipping MCP configure for "${targetId}": BAPM_NO_GLOBAL_MCP avoids writing the user-global MCP config shared by every project`,
        target: targetId,
        skip: true,
      });
      continue;
    }

    // Per-target bake: omit APM placeholder bake when mcpEnvMode === "translate".
    // `mcpHeadersEnvMode` may translate headers while env still bakes (Codex).
    // Missing modes ⇒ bake. `{bake:NAME}` still resolved fail-closed.
    // Lookup: overrides → process.env → effective manifest `env` (fills gaps).
    const bakeMode = target.mcpEnvMode === "translate" ? "translate" : "bake";
    const headersBakeMode =
      target.mcpHeadersEnvMode === "translate" || target.mcpHeadersEnvMode === "bake"
        ? target.mcpHeadersEnvMode
        : bakeMode;
    const manifestEnv = args.rootManifest.env;
    let configuredServers: McpServerConfig[];
    try {
      configuredServers = approved.map((server) => {
        const baked = bakeMcpServerMaps(server, {
          mode: bakeMode,
          headersMode: headersBakeMode,
          ...(manifestEnv !== undefined ? { manifestEnv } : {}),
        });
        // Internal provenance stays on `approved` for trust/lock inventory; the
        // host only receives the portable MCP server contract.
        const { origin: _origin, packageName: _packageName, ...hostServer } = baked;
        return hostServer;
      });
    } catch (error) {
      if (error instanceof McpEnvBakeError) {
        throw new InstallError("INSTALL_MCP_ENV_BAKE", error.message, {
          details: {
            missing: error.missing,
            targetId,
            mcpEnvMode: bakeMode,
            mcpHeadersEnvMode: headersBakeMode,
          },
          cause: error,
        });
      }
      throw error;
    }

    const managedServers = pruneByTarget.get(targetId);
    const report = (await configureMcp(configuredServers, {
      cwd: args.cwd,
      targetId,
      deployRoots: [...target.deployRoots],
      scope: args.scope,
      ...(managedServers && managedServers.length > 0 ? { managedServers } : {}),
    })) as ConfigureMcpReport;
    if (!report || report.targetId !== targetId) {
      throw new InstallError(
        "INSTALL_FAILED",
        `Target "${targetId}" configured MCP without target-owned deployment attribution`,
        { details: { targetId, reportTargetId: report?.targetId } },
      );
    }
    const adapterDiagnostics = (
      report as (ConfigureMcpReport & { diagnostics?: unknown[] }) | undefined
    )?.diagnostics;
    if (adapterDiagnostics) {
      args.diagnostics.push(...adapterDiagnostics.map(markSkipDiagnosticWarn));
    }

    const reportedConfigPath =
      typeof report?.configPath === "string" ? report.configPath.trim() : "";
    const normalizedConfigPath = normalizeMcpConfigPath(args.cwd, reportedConfigPath);
    if (!normalizedConfigPath) {
      throw new InstallError(
        "INSTALL_FAILED",
        `Target "${targetId}" configured MCP without a usable config path (project-relative, absolute, or ~/…)`,
        { details: { targetId, configPath: report?.configPath } },
      );
    }

    configuredTargets.push({ targetId, configPath: normalizedConfigPath });

    if (args.scope !== "global" && homeScopedMcp && !warnedGlobalTargets.has(targetId)) {
      warnedGlobalTargets.add(targetId);
      args.diagnostics.push({
        code: "MCP_GLOBAL_CONFIG_WARN",
        message:
          `MCP config for "${targetId}" was written to ${reportedConfigPath}, ` +
          "a user-global file shared by every project on this machine. " +
          "Servers with the same name are overwritten by the last install. " +
          `Use --exclude ${targetId} (or --exclude copilot,windsurf for both) to skip global MCP, ` +
          "or project-local MCP if the host supports it.",
        target: targetId,
        path: reportedConfigPath,
        warn: true,
      });
    }
  }

  const updated = refreshMcpLockInventory({
    cwd: args.cwd,
    frozen: args.frozen,
    document: args.lockDocument,
    lockPath: args.lockPath,
    previousLockFilename: args.previousLockFilename,
    update: {
      kind: "declarations",
      servers: approved,
      ...(configuredTargets.length > 0 ? { targets: configuredTargets } : {}),
    },
  });

  return {
    ...updated,
    withholdFatal,
    withholdMessage,
    withheldPackages: uniqueWithheld,
  };
}

/**
 * Compute per-target names that must be removed from host config.
 *
 * Full installs know the complete approved set, so any previously managed name
 * missing from it is stale (removed manifest entry or deny). MCP-only runs do
 * not resolve dependency nodes, so they only prune names whose recorded lock
 * package is explicitly denied — never sweeping other servers blindly.
 */
function resolveMcpPruneInventory(args: {
  document?: LockfileDocument;
  activeTargets: string[];
  approved: CollectedMcpServer[];
  only?: InstallOnlyMode;
  rootName: string;
  orgExecutables: PolicyExecutables;
  projectSurface: ExecutableGrantSurface;
  userSurface: ExecutableGrantSurface;
  diagnostics: unknown[];
}): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (args.activeTargets.length === 0 || !args.document) return result;

  const previous = readMcpTargetInventory(args.document);
  const approvedNames = new Set(args.approved.map((server) => server.name).filter(Boolean));

  for (const targetId of args.activeTargets) {
    const names = previous.get(targetId);
    if (!names || names.length === 0) continue;
    const prune: string[] = [];
    for (const name of names) {
      if (approvedNames.has(name)) continue;
      if (args.only === "mcp") {
        const packageName = readLockedMcpPackage(args.document, name);
        if (!packageName || packageName === args.rootName) continue;
        const decision = resolveExecutableTrust({
          packageName,
          executableType: "mcp",
          orgExecutables: args.orgExecutables,
          projectSurface: args.projectSurface,
          userSurface: args.userSurface,
        });
        if (decision.outcome !== "deny") continue;
      }
      prune.push(name);
    }
    if (prune.length > 0) result.set(targetId, prune);
  }
  return result;
}

function readMcpTargetInventory(document: LockfileDocument): Map<string, string[]> {
  const doc = document as LockfileDocument & Record<string, unknown>;
  const out = new Map<string, string[]>();

  const targetServers = asUnknownRecord(doc.mcp_target_servers);
  for (const [targetId, raw] of Object.entries(targetServers)) {
    if (!Array.isArray(raw)) continue;
    const names = raw.filter((name): name is string => typeof name === "string" && name.length > 0);
    if (names.length > 0) out.set(targetId, names);
  }

  const configs = asUnknownRecord(doc.mcp_configs);
  for (const [targetId, raw] of Object.entries(configs)) {
    const config = asUnknownRecord(raw);
    if (!Array.isArray(config.servers)) continue;
    const names = config.servers.filter(
      (name): name is string => typeof name === "string" && name.length > 0,
    );
    if (names.length === 0) continue;
    const merged = new Set([...(out.get(targetId) ?? []), ...names]);
    out.set(targetId, [...merged]);
  }

  return out;
}

function readLockedMcpPackage(document: LockfileDocument, serverName: string): string {
  const doc = document as LockfileDocument & Record<string, unknown>;
  const entry = asUnknownRecord(asUnknownRecord(doc.mcp_servers)[serverName]);
  if (typeof entry.package === "string" && entry.package.trim()) return entry.package.trim();
  const provenance = asUnknownRecord(asUnknownRecord(doc.mcp_config_provenance)[serverName]);
  return typeof provenance.package === "string" ? provenance.package.trim() : "";
}

function asUnknownRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Cleanup-only configure pass for `approved.length === 0`: rewrite host configs
 * just enough to drop bapm-managed entries. Failures stay warnings so a deny
 * grant is never reported as failed because a host file could not be rewritten.
 */
async function pruneTargetMcpConfigs(args: {
  cwd: string;
  registry?: IntegrationRegistry;
  activeTargets: string[];
  excludeSet: Set<string>;
  pruneByTarget: Map<string, string[]>;
  diagnostics: unknown[];
  scope?: DeploymentScope;
}): Promise<void> {
  if (!args.registry || args.pruneByTarget.size === 0) return;

  for (const targetId of args.activeTargets) {
    const managedServers = args.pruneByTarget.get(targetId);
    if (!managedServers || managedServers.length === 0) continue;
    if (args.excludeSet.has(targetId)) continue;
    const target = findTarget(args.registry, targetId);
    if (!target) continue;
    const configureMcp = getConfigureMcp(target);
    if (!configureMcp) continue;

    try {
      const report = (await configureMcp([], {
        cwd: args.cwd,
        targetId,
        deployRoots: [...target.deployRoots],
        scope: args.scope,
        managedServers: [...managedServers],
      })) as ConfigureMcpReport | undefined;
      const adapterDiagnostics = report?.diagnostics;
      if (adapterDiagnostics) {
        args.diagnostics.push(...adapterDiagnostics.map(markSkipDiagnosticWarn));
      }
    } catch (error) {
      args.diagnostics.push({
        code: "MCP_MANAGED_PRUNE_FAILED",
        message: `Could not remove bapm-managed MCP entries for "${targetId}": ${
          error instanceof Error ? error.message : String(error)
        }. Remove the server(s) from the host config manually: ${managedServers.join(", ")}`,
        target: targetId,
        servers: [...managedServers],
        warn: true,
      });
    }
  }
}

type McpLockInventoryUpdate =
  | {
      kind: "declarations";
      servers: CollectedMcpServer[];
      target?: { targetId: string; configPath: string };
      /** All targets configured this run; each gets `mcp_configs`/`mcp_target_servers`. */
      targets?: Array<{ targetId: string; configPath: string }>;
    }
  | { kind: "prune"; rootPackageName: string; livePackageNames?: string[] }
  | { kind: "clear" };

/**
 * Keep lock MCP inventory in sync on every non-frozen install path — including
 * early returns where no target config is written. `prune` removes stale
 * root-owned server entries while preserving dependency-owned ones; `clear`
 * drops every MCP inventory bag (all servers withheld); `declarations` writes
 * the current authored set, optionally with the configured target.
 */
function refreshMcpLockInventory(args: {
  cwd: string;
  frozen: boolean;
  document?: LockfileDocument;
  lockPath?: string;
  previousLockFilename?: string;
  update: McpLockInventoryUpdate;
}): { lockPath?: string; lockDocument?: LockfileDocument } {
  if (args.frozen || !args.document) {
    return { lockPath: args.lockPath, lockDocument: args.document };
  }

  const doc = args.document as LockfileDocument & Record<string, unknown>;
  const hadInventory =
    hasMcpEntries(doc.mcp_servers) ||
    hasMcpEntries(doc.mcp_configs) ||
    hasMcpEntries(doc.mcp_target_servers) ||
    hasMcpEntries(doc.mcp_config_provenance);
  const update = args.update;
  const before = update.kind === "declarations" ? undefined : inventoryFingerprint(doc);

  if (update.kind === "declarations") {
    applyMcpInventoryToLock({
      document: args.document,
      servers: update.servers,
      ...update.target,
      ...(update.targets ? { targets: update.targets } : {}),
    });
    // Nothing existed and nothing is authored: avoid a redundant second lock write.
    if (
      !hadInventory &&
      update.servers.length === 0 &&
      !update.target &&
      !(update.targets && update.targets.length > 0)
    ) {
      return { lockPath: args.lockPath, lockDocument: args.document };
    }
  } else if (update.kind === "prune") {
    if (!hasMcpEntries(doc.mcp_servers)) {
      return { lockPath: args.lockPath, lockDocument: args.document };
    }
    scrubMcpInventory({
      document: args.document,
      rootPackageName: update.rootPackageName,
      ...(update.livePackageNames ? { livePackageNames: update.livePackageNames } : {}),
    });
    if (inventoryFingerprint(doc) === before) {
      return { lockPath: args.lockPath, lockDocument: args.document };
    }
  } else {
    if (!hadInventory) {
      return { lockPath: args.lockPath, lockDocument: args.document };
    }
    scrubMcpInventory({ document: args.document, all: true });
  }

  const lockPath = partitionAndWriteLockfiles(args.document, {
    cwd: args.cwd,
    sourcePath: args.lockPath,
    sourceFilename: args.previousLockFilename,
  }).sharedPath;
  return { lockPath, lockDocument: args.document };
}

function inventoryFingerprint(doc: Record<string, unknown>): string {
  return JSON.stringify([
    doc.mcp_servers ?? null,
    doc.mcp_configs ?? null,
    doc.mcp_target_servers ?? null,
    doc.mcp_config_provenance ?? null,
  ]);
}

function hasMcpEntries(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value) && typeof value === "object" && Object.keys(value as object).length > 0;
}

/** Discover + gate + materialize dependency package-root `bin/` (install-trust-bin). */
function deployBinsAfterConsent(args: {
  cwd: string;
  rootManifest: BapmManifest;
  nodes: ResolvedNode[];
  trustBin: "allow" | "deny" | "default";
  frozen: boolean;
  isInteractive?: boolean;
  env?: Record<string, string | undefined>;
  stdinIsTTY?: boolean;
  binDeployRoot?: string;
  configDir?: string;
  policyPath?: string;
  noPolicy: boolean;
  noRepoPolicy?: boolean;
  policyPorts?: {
    policyProviders?: string[];
    providers?: string[];
    listGitRemotes?: RunInstallOptions["listGitRemotes"];
    remotes?: RunInstallOptions["remotes"];
    fetchPolicyUrl?: RunInstallOptions["fetchPolicyUrl"];
    httpGet?: RunInstallOptions["httpGet"];
    fetchAncestor?: RunInstallOptions["fetchAncestor"];
    defaultFetchFailure?: RunInstallOptions["defaultFetchFailure"];
    implementationDefaultHost?: string;
  };
  trustContext?: InstallTrustContext;
}): unknown[] {
  const diagnostics: unknown[] = [];
  const { projectSurface, userSurface, orgExecutables } =
    args.trustContext ??
    resolveInstallTrustContext({
      cwd: args.cwd,
      rootManifest: args.rootManifest,
      configDir: args.configDir,
      policyPath: args.policyPath,
      noPolicy: args.noPolicy,
      noRepoPolicy: args.noRepoPolicy === true,
      policyPorts: args.policyPorts,
    });
  const deployRoot = args.binDeployRoot
    ? resolve(args.binDeployRoot)
    : defaultBinDeployRoot(args.cwd);
  for (const node of args.nodes) {
    const packageRoot = dependencyPackageRoot(node);
    if (!packageRoot) continue;
    const files = discoverPackageBinFiles(packageRoot);
    if (files.length === 0) continue;

    const consent = resolveBinDeployConsent({
      packageName: node.name,
      trustBin: args.trustBin,
      isInteractive: args.isInteractive,
      frozen: args.frozen,
      env: args.env,
      stdinIsTTY: args.stdinIsTTY,
      orgExecutables,
      projectSurface,
      userSurface,
    });

    if (!consent.deploy) {
      diagnostics.push({
        code: "BIN_TRUST_WITHHOLD",
        message:
          consent.reason ?? `bin deploy withheld for "${node.name}" (consent / ExecutableTrust)`,
        packageName: node.name,
        withhold: true,
        skip: true,
        warn: consent.warn,
        trustBin: args.trustBin,
        ladderOutcome: consent.ladderOutcome,
        outcome: consent.outcome,
      });
      continue;
    }

    materializeBinFiles({ files, deployRoot });
  }

  return diagnostics;
}

function dependencyPackageRoot(node: ResolvedNode): string | undefined {
  for (const candidate of [node.packageRoot, node.path]) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** Load effective org `executables` for MCP trust (best-effort; absent → empty). */
function loadOrgExecutablesForTrust(args: {
  cwd: string;
  policyPath?: string;
  noPolicy: boolean;
  noRepoPolicy?: boolean;
  policyPorts?: {
    policyProviders?: string[];
    providers?: string[];
    listGitRemotes?: RunInstallOptions["listGitRemotes"];
    remotes?: RunInstallOptions["remotes"];
    fetchPolicyUrl?: RunInstallOptions["fetchPolicyUrl"];
    httpGet?: RunInstallOptions["httpGet"];
    fetchAncestor?: RunInstallOptions["fetchAncestor"];
    defaultFetchFailure?: RunInstallOptions["defaultFetchFailure"];
    implementationDefaultHost?: string;
  };
}): PolicyExecutables {
  if (args.noPolicy) return { deny_all: false, deny: [] };
  try {
    const gate = runPolicyGate({
      cwd: args.cwd,
      policyPath: args.policyPath,
      policy: args.policyPath,
      noPolicy: args.noPolicy,
      noRepoPolicy: args.noRepoPolicy === true,
      providers: args.policyPorts?.providers ?? args.policyPorts?.policyProviders,
      policyProviders: args.policyPorts?.policyProviders ?? args.policyPorts?.providers,
      listGitRemotes: args.policyPorts?.listGitRemotes,
      remotes: args.policyPorts?.remotes,
      fetchPolicyUrl: args.policyPorts?.fetchPolicyUrl,
      httpGet: args.policyPorts?.httpGet,
      fetchAncestor: args.policyPorts?.fetchAncestor as never,
      defaultFetchFailure: args.policyPorts?.defaultFetchFailure,
      implementationDefaultHost: args.policyPorts?.implementationDefaultHost,
      candidates: [],
    });
    if (gate.skipped || !gate.document?.executables) {
      return { deny_all: false, deny: [] };
    }
    return {
      deny_all: gate.document.executables.deny_all === true,
      deny: Array.isArray(gate.document.executables.deny) ? gate.document.executables.deny : [],
    };
  } catch {
    // Policy gate failures are handled on the install policy path; trust floor soft-falls back.
    return { deny_all: false, deny: [] };
  }
}

/** Alias preferred by design docs. */
export const installProject = runInstall;

function verifyTreeSha256OrThrow(args: { cwd: string; document: LockfileDocument }): void {
  const violations = collectTreeSha256Violations(args);
  if (violations.length === 0) return;
  const first = violations[0]!;
  throw new InstallError("INSTALL_FROZEN_HASH_MISMATCH", first.message, {
    details: {
      entry: first.entry,
      kind: first.kind,
      expected: first.expected,
      observed: first.observed,
      integrity: "tree_sha256",
      frozen: true,
    },
  });
}

function applyPolicyGate(args: {
  cwd: string;
  policyPath?: string;
  noPolicy: boolean;
  noRepoPolicy?: boolean;
  nodes: ResolvedNode[];
  /** When set (dry-run), use these candidates instead of deriving from nodes. */
  candidatesOverride?: PolicyCandidate[];
  policyProviders?: string[];
  providers?: string[];
  listGitRemotes?: RunInstallOptions["listGitRemotes"];
  remotes?: RunInstallOptions["remotes"];
  fetchPolicyUrl?: RunInstallOptions["fetchPolicyUrl"];
  httpGet?: RunInstallOptions["httpGet"];
  fetchAncestor?: RunInstallOptions["fetchAncestor"];
  defaultFetchFailure?: RunInstallOptions["defaultFetchFailure"];
  implementationDefaultHost?: string;
}): unknown[] {
  const candidates = args.candidatesOverride ?? nodesToCandidates(args.nodes);
  const gate = assertPolicyGateAllows({
    cwd: args.cwd,
    policyPath: args.policyPath,
    policy: args.policyPath,
    noPolicy: args.noPolicy,
    noRepoPolicy: args.noRepoPolicy === true,
    providers: args.providers ?? args.policyProviders,
    policyProviders: args.policyProviders ?? args.providers,
    listGitRemotes: args.listGitRemotes,
    remotes: args.remotes,
    fetchPolicyUrl: args.fetchPolicyUrl,
    httpGet: args.httpGet,
    fetchAncestor: args.fetchAncestor as never,
    defaultFetchFailure: args.defaultFetchFailure,
    implementationDefaultHost: args.implementationDefaultHost,
    candidates,
    dependencies: candidates.map((c) => ({
      name: c.id,
      id: c.id,
      ref: c.ref,
      constraint: c.constraint,
      direct: c.direct,
      depth: c.depth,
      path: c.path,
      source: c.source,
    })),
    graphDepth: args.nodes.reduce((m, n) => Math.max(m, n.depth ?? 0), 0),
    maxDepthObserved: args.nodes.reduce((m, n) => Math.max(m, n.depth ?? 0), 0),
  });
  const out: unknown[] = [...gate.diagnostics];
  if (gate.result?.outcome === "warn") {
    for (const v of gate.result.findings ?? gate.result.violations) {
      out.push({
        code: "POLICY_WARN",
        message: v.message,
        policy: true,
        enforcement: "warn",
      });
    }
  }
  return out;
}

function nodesToCandidates(nodes: ResolvedNode[]): PolicyCandidate[] {
  return nodes.map((n) => ({
    id: n.name,
    name: n.name,
    ref: n.resolved_commit ?? n.constraint,
    constraint: n.constraint ?? n.resolved_commit,
    depth: n.depth,
    direct: n.depth === 1,
    kind: n.kind,
    path: n.path,
    source: n.kind === "local" ? "local" : undefined,
  }));
}

async function extractArchiveIntoProject(archivePath: string, cwd: string): Promise<void> {
  const resolvedArchive = resolve(archivePath);
  try {
    await extractPackArchive({
      archivePath: resolvedArchive,
      outputDir: cwd,
      cwd,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new InstallError("INSTALL_ARCHIVE", `Install from archive failed: ${message}`, {
      cause,
      details: { archivePath: resolvedArchive },
    });
  }

  // Fail closed if landed layout has no dual-read parseable manifest
  try {
    loadManifest({ cwd });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new InstallError(
      "INSTALL_ARCHIVE",
      `Archive install left no parseable manifest under project root: ${message}`,
      { cause, details: { archivePath: resolvedArchive } },
    );
  }
}

function assertForcedTargetRegistered(
  forcedTargetId: string | undefined,
  registry: IntegrationRegistry | undefined,
): void {
  if (!forcedTargetId) return;
  if (!registry || !findTarget(registry, forcedTargetId)) {
    throw new InstallError(
      "INSTALL_UNKNOWN_TARGET",
      `Unknown or unregistered target: ${forcedTargetId}`,
      { details: { target: forcedTargetId } },
    );
  }
}

function assertActiveTargetsRegistered(
  activeTargets: string[],
  registry: IntegrationRegistry | undefined,
): void {
  for (const id of activeTargets) {
    if (!registry || !findTarget(registry, id)) {
      throw new InstallError("INSTALL_UNKNOWN_TARGET", `Unknown or unregistered target: ${id}`, {
        details: { target: id, activeTargets },
      });
    }
  }
}

/** Preserve first-seen order while dropping duplicates. */
function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Global MCP is opt-in per integration; refuse unsupported hosts clearly. */
function assertGlobalMcpSupported(
  activeTargets: string[],
  registry: IntegrationRegistry | undefined,
  excludeSet: Set<string>,
): void {
  const unsupported: string[] = [];
  for (const id of activeTargets) {
    if (excludeSet.has(id)) continue;
    const target = registry ? findTarget(registry, id) : undefined;
    if (target && target.supportsGlobalMcp !== true) unsupported.push(id);
  }
  if (unsupported.length === 0) return;
  throw new InstallError(
    "INSTALL_GLOBAL_UNSUPPORTED",
    `Global MCP is not supported for target(s): ${unsupported.join(", ")}. Supported global MCP hosts in this release: cursor, opencode.`,
    { details: { unsupported, activeTargets: [...activeTargets] } },
  );
}

async function resolveActiveTargets(args: {
  cwd: string;
  registry?: IntegrationRegistry;
  override?: string[];
  forcedTargetId?: string;
  manifestActive?: string[];
  configTargetId?: string;
  scope?: DeploymentScope;
}): Promise<string[]> {
  // 1. CLI / forced --target wins over everything.
  if (args.forcedTargetId) {
    return [args.forcedTargetId];
  }

  // 2. Programmatic override (multi-capable) — same semantics as manifest `active`.
  if (args.override && args.override.length > 0) {
    return dedupePreserveOrder(args.override);
  }

  // 3. Manifest `active` (local overlay already merged; non-empty when present).
  if (args.manifestActive && args.manifestActive.length > 0) {
    return dedupePreserveOrder(args.manifestActive);
  }

  // 4. User config default target (before detect, after explicit project selection).
  if (args.configTargetId) {
    return [args.configTargetId];
  }

  // 5. Sole auto-detect, else fail-closed.
  if (!args.registry) {
    throw new InstallError(
      "INSTALL_UNKNOWN_TARGET",
      "Target detection is unavailable; pass --target <id> or set active in the manifest",
      { details: { detectedTargets: [], registry: "missing" } },
    );
  }

  const detection = await detectRegisteredTargets(args.registry, args.cwd, args.scope);
  if (detection.detectedIds.length === 1) return detection.detectedIds;
  throw new InstallError(
    "INSTALL_UNKNOWN_TARGET",
    args.scope === "global"
      ? `Global target detection is missing or ambiguous; pass --target <id> (supported: cursor, opencode) or set active in ~/.bapm/bapm.yml`
      : "Target detection is missing or ambiguous; pass --target <id> or set active in the manifest",
    { details: { detectedTargets: detection.detectedIds, diagnostics: detection.diagnostics } },
  );
}

async function detectRegisteredTargets(
  registry: IntegrationRegistry,
  cwd: string,
  scope: DeploymentScope = "project",
): Promise<{ detectedIds: string[]; diagnostics: unknown[] }> {
  // A custom registry `detect(cwd)` is project-only; global detection must use
  // each target's user-scope detector.
  if (scope !== "global" && typeof registry.detect === "function") return registry.detect(cwd);

  const detectedIds: string[] = [];
  const diagnostics: unknown[] = [];
  for (const target of listRegistry(registry)) {
    try {
      const detect = scope === "global" ? target.detectGlobal : target.detect;
      if (detect && (await detect({ cwd }))) detectedIds.push(target.id);
    } catch {
      diagnostics.push({
        targetId: target.id,
        message: `Target "${target.id}" detection did not match`,
      });
    }
  }
  return { detectedIds, diagnostics };
}

function assertRegisteredExcludeIds(
  excludeIds: string[],
  registry: IntegrationRegistry | undefined,
): void {
  for (const id of excludeIds) {
    if (!registry?.get(id)) {
      throw new InstallError(
        "INSTALL_UNKNOWN_EXCLUDE",
        `Unknown or unregistered exclude id: ${id}`,
        { details: { exclude: id } },
      );
    }
  }
}

/**
 * Trust only deployment attribution returned by the selected target. Core
 * verifies generic containment but never derives a target's paths or owners.
 */
function collectTargetDeployedHashes(
  cwd: string,
  target: BapmIntegration,
  report: void | MaterializeReport,
): ReturnType<typeof collectDeployedHashes> {
  if (report === undefined) return [];
  if (!report || !Array.isArray(report.deployedFiles)) {
    throw new InstallError(
      "INSTALL_FAILED",
      `Target "${target.id}" materialize report is missing target-owned deployment attribution`,
      { details: { targetId: target.id, report } },
    );
  }
  if (report.deployedFiles.length === 0) return [];
  if (report.targetId !== target.id) {
    throw new InstallError(
      "INSTALL_FAILED",
      `Target "${target.id}" materialize report has invalid target-owned deployment attribution`,
      { details: { targetId: target.id, reportTargetId: report.targetId } },
    );
  }

  for (const file of report.deployedFiles) {
    const relPath = typeof file?.path === "string" ? file.path.trim() : "";
    const absolutePath = relPath ? resolve(cwd, relPath) : "";
    if (!relPath || !isPathWithinTargetRoots(cwd, absolutePath, target.deployRoots)) {
      throw new InstallError(
        "INSTALL_FAILED",
        `Target "${target.id}" reported deployment outside its declared roots: ${relPath || "(missing path)"}`,
        { details: { targetId: target.id, path: relPath, deployRoots: target.deployRoots } },
      );
    }
  }
  return collectDeployedHashes(cwd, report);
}

function isPathWithinTargetRoots(cwd: string, path: string, deployRoots: string[]): boolean {
  return deployRoots.some((root) => {
    const rootPath = resolve(cwd, root);
    const rel = relative(rootPath, path);
    return (
      rel === "" ||
      (!rel.startsWith("..") && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`))
    );
  });
}

function listRegistry(registry: IntegrationRegistry): BapmIntegration[] {
  if (typeof registry.list === "function") return registry.list();
  if (typeof registry.getAll === "function") return registry.getAll();
  return [];
}

function findTarget(registry: IntegrationRegistry, id: string): BapmIntegration | undefined {
  if (typeof registry.get === "function") {
    const t = registry.get(id);
    if (t) return t;
  }
  return listRegistry(registry).find((t) => String(t.id) === id);
}

/**
 * Normalize configureMcp report paths for lock inventory.
 * Accepts project-relative paths, absolute home/out-of-project paths, and `~/…` tilde forms.
 */
function normalizeMcpConfigPath(cwd: string, reported: string): string | undefined {
  const trimmed = reported.trim();
  if (!trimmed) return undefined;

  if (trimmed === "~" || trimmed.startsWith("~/")) {
    return trimmed.replace(/\\/g, "/");
  }

  if (isAbsolute(trimmed)) {
    return trimmed.replace(/\\/g, "/");
  }

  const resolved = resolve(cwd, trimmed);
  const rel = relative(cwd, resolved);
  if (!rel || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    return undefined;
  }
  return rel.replace(/\\/g, "/");
}

function collectPackageDeclaredTargets(
  nodes: ResolvedNode[],
  primitives: AttributedPrimitive[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const n of nodes) {
    const root = n.packageRoot;
    if (!root || !existsSync(root)) continue;
    try {
      const { document } = loadManifest({ cwd: root, allowReplace: true });
      map.set(n.name, declaredTargetIds(document));
    } catch {
      map.set(n.name, []);
    }
  }

  for (const p of primitives) {
    if (!p.packageName || map.has(p.packageName)) continue;
    if (p.source === "local") continue;
    const pkgRoot = findManifestRoot(p.path);
    if (!pkgRoot) {
      map.set(p.packageName, []);
      continue;
    }
    try {
      const { document } = loadManifest({ cwd: pkgRoot, allowReplace: true });
      map.set(p.packageName, declaredTargetIds(document));
    } catch {
      map.set(p.packageName, []);
    }
  }

  return map;
}

function findManifestRoot(filePath: string): string | undefined {
  let dir = resolve(filePath);
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, "apm.yml")) || existsSync(join(dir, "bapm.yml"))) {
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

function filterByIntersection(
  primitives: AttributedPrimitive[],
  activeTargetId: string,
  packageTargets: Map<string, string[]>,
  rootManifest: BapmManifest,
  nodes: ResolvedNode[] = [],
): AttributedPrimitive[] {
  const rootDeclared = declaredTargetIds(rootManifest);
  const consumerAuth = new Set(rootDeclared.length > 0 ? rootDeclared : [activeTargetId]);
  if (!consumerAuth.has(activeTargetId)) return [];

  const perDepTargets = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.targetSubset && n.targetSubset.length > 0) {
      perDepTargets.set(n.name, n.targetSubset);
    }
  }

  return primitives.filter((p) => {
    if (p.source === "local") {
      return consumerAuth.has(activeTargetId);
    }
    const pkgName = p.packageName ?? p.source.slice("dependency:".length);
    const depSubset = perDepTargets.get(pkgName);
    if (depSubset && depSubset.length > 0 && !depSubset.includes(activeTargetId)) {
      return false;
    }
    const declared = packageTargets.get(pkgName);
    if (!declared || declared.length === 0) {
      return true;
    }
    return declared.includes(activeTargetId);
  });
}

/**
 * Filter skill primitives by per-dep `skillSubset` (req-mf-022 empty-match warn).
 * Non-skill primitives are never dropped solely because a skill subset is set.
 */
function applySkillSubsets(
  primitives: AttributedPrimitive[],
  nodes: ResolvedNode[],
  diagnostics: unknown[],
): AttributedPrimitive[] {
  const subsetByPkg = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.skillSubset && n.skillSubset.length > 0) {
      subsetByPkg.set(n.name, n.skillSubset);
    }
  }
  if (subsetByPkg.size === 0) return primitives;

  const out: AttributedPrimitive[] = [];
  const keptSkillsByPkg = new Map<string, string[]>();
  const availableSkillsByPkg = new Map<string, string[]>();

  for (const p of primitives) {
    const pkgName = p.packageName ?? (p.source.startsWith("dependency:") ? p.source.slice(11) : "");
    const subset = pkgName ? subsetByPkg.get(pkgName) : undefined;
    if (!subset) {
      out.push(p);
      continue;
    }
    if (!isSkillPrimitive(p)) {
      out.push(p);
      continue;
    }
    const avail = availableSkillsByPkg.get(pkgName) ?? [];
    avail.push(p.name);
    availableSkillsByPkg.set(pkgName, avail);
    if (skillMatchesSubset(p, subset)) {
      out.push(p);
      const kept = keptSkillsByPkg.get(pkgName) ?? [];
      kept.push(p.name);
      keptSkillsByPkg.set(pkgName, kept);
    }
  }

  for (const [pkgName, subset] of subsetByPkg) {
    const kept = keptSkillsByPkg.get(pkgName) ?? [];
    if (kept.length > 0) continue;
    const available = availableSkillsByPkg.get(pkgName) ?? [];
    const node = nodes.find((n) => n.name === pkgName);
    const depLabel =
      node?.repo_url ??
      (typeof node?.identity === "string" ? node.identity : undefined) ??
      (node?.kind.startsWith("git") ? `git:${pkgName}` : pkgName);
    diagnostics.push({
      code: "EMPTY_SKILL_SUBSET",
      message: `Skill subset matched zero skills for ${depLabel}: requested [${subset.join(", ")}]; available [${available.join(", ") || "(none)"}]`,
      dependency: depLabel,
      packageName: pkgName,
      requested: subset,
      available,
    });
  }

  return out;
}

function isSkillPrimitive(p: AttributedPrimitive): boolean {
  const t = String(p.type ?? "").toLowerCase();
  return !t || t === "skill";
}

function skillMatchesSubset(p: AttributedPrimitive, subset: string[]): boolean {
  if (subset.includes(p.name)) return true;
  const dir = typeof p.skillDirectory === "string" ? p.skillDirectory.replaceAll("\\", "/") : "";
  for (const item of subset) {
    const normalized = item.replaceAll("\\", "/");
    if (normalized === p.name) return true;
    if (dir && (dir === normalized || dir.endsWith(`/${normalized}`))) return true;
    if (normalized.includes("/") && normalized.split("/").pop() === p.name) return true;
  }
  return false;
}

function extractDeclarationOrder(manifest: BapmManifest): string[] {
  const apm = [
    ...(Array.isArray(manifest.dependencies?.apm) ? manifest.dependencies!.apm! : []),
    ...(Array.isArray(manifest.devDependencies?.apm) ? manifest.devDependencies!.apm! : []),
  ];
  const names: string[] = [];
  for (const entry of apm) {
    const n = entryNameHint(entry);
    if (n) names.push(n);
  }
  return names;
}

function entryNameHint(entry: DependencyEntry): string | undefined {
  if (typeof entry === "string") return entry.split("/").pop();
  const o = entry as ObjectDependency;
  if (o.alias && typeof o.alias === "string") return o.alias;
  if (o.path) {
    return o.path.replace(/^\.\//, "").split("/").filter(Boolean).pop();
  }
  if (o.git) {
    return o.git
      .replace(/\.git$/i, "")
      .split("/")
      .pop();
  }
  if (o.id) return o.id;
  return undefined;
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function restoreGitUrl(repoUrl: string | undefined): string | undefined {
  if (!repoUrl) return undefined;
  if (repoUrl.startsWith("local:")) return undefined;
  if (repoUrl.includes("://")) return repoUrl;
  return `https://${repoUrl}`;
}
