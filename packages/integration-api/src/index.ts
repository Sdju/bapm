/**
 * @b-apm/integration-api — contracts + registry between @b-apm/core and host integrations.
 */

export type {
  AttributedPrimitive,
  AttributedPrimitiveSet,
  BapmIntegration,
  CompileContext,
  CompileFn,
  CompileReport,
  ConfigureMcpContext,
  ConfigureMcpFn,
  ConfigureMcpReport,
  ConfigureLspContext,
  ConfigureLspFn,
  ConfigureLspReport,
  DeployedFile,
  LspServerConfig,
  DeploymentScope,
  MaterializeContext,
  MaterializeReport,
  McpEnvMode,
  McpServerConfig,
  MarketplaceOutputCapability,
  MarketplaceOutputIntegration,
  MarketplaceOutputRegistry,
  PrimitiveSource,
  PrimitiveType,
  TargetDetectFn,
  TargetDetectionDiagnostic,
  DetectedTargetsResult,
  TargetId,
  IntegrationRegistry,
} from "./types.ts";

export { createIntegrationRegistry, createMarketplaceOutputRegistry } from "./registry.ts";

export type { CompilePrimitivesMarkdownOptions, InstructionCompileMode } from "./compile.ts";
export { compilePrimitivesMarkdown } from "./compile.ts";

export type { ReadJsonDocumentOptions } from "./config.ts";
export { readJsonDocument, stripJsonc, writeJsonDocument } from "./config.ts";

export type { FrontmatterField, ParsedFrontmatter } from "./frontmatter.ts";
export { frontmatterList, parseFrontmatter, renderFrontmatter } from "./frontmatter.ts";

export type {
  HookDeploymentMode,
  HookScriptDestinationArgs,
  HookSourceReadResult,
  MaterializeDiagnostic,
  MergeHookDeploymentArgs,
  MergeHookDeploymentResult,
  ReadHookSourceOptions,
} from "./hooks.ts";
export { mergeHookDeployment, normalizeHookEventName, readHookSource } from "./hooks.ts";

export type {
  EnvReferenceStyle,
  MergeMcpServersArgs,
  MergeMcpServersResult,
  SkipMcpWhenDirMissingArgs,
} from "./mcp.ts";
export {
  extractEnvReference,
  hasEnvReference,
  mergeMcpServers,
  normalizeNamedEntries,
  skipMcpWhenDirMissing,
  translateEnvMap,
  translateEnvReferences,
} from "./mcp.ts";

export type {
  CreateMaterializeRunArgs,
  MaterializeRun,
  SkillsOnlyHandlersArgs,
  UnsupportedPrimitiveArgs,
} from "./materialize.ts";
export {
  createMaterializeRun,
  skillsOnlyHandlers,
  unsupportedPrimitiveDiagnostic,
} from "./materialize.ts";

export type { IntegrationCapabilities } from "./capabilities.ts";
export { resolveIntegrationCapabilities } from "./capabilities.ts";

export type { MergeLspServersArgs, MergeLspServersResult } from "./mcp.ts";
export { mergeLspServers } from "./mcp.ts";

export { primitivePackageKey, safeHookSlug } from "./naming.ts";

export {
  detectAnyPath,
  hasDeployRoot,
  requireDeployRoots,
  resolveEnvHome,
  resolveXdgConfigHome,
} from "./paths.ts";

export {
  BUILD_ID_LINE_PATTERN,
  BUILD_ID_PLACEHOLDER,
  applyBuildId,
  buildIdBody,
  computeBuildId,
  hasBuildIdLine,
  hasValidBuildId,
  stabilizeBuildId,
} from "./buildId.ts";

export type {
  CopyHookScriptArgs,
  CopyHookScriptResult,
  HookOwnershipSidecar,
  PrimitiveMaterializeContext,
  PrimitiveMaterializeHandler,
  PrimitiveMaterializeHandlers,
  PrimitiveMaterializeKind,
  RenderNativeHookEntriesArgs,
  RenderNativeHookEntriesResult,
  RewriteHookCommand,
} from "./helpers.ts";

export {
  SHARED_COMMAND_FRONTMATTER_KEYS,
  assertUnderDeployRoots,
  compileMarkdownReport,
  copyHookScript,
  copyPortableSkillDirectory,
  copySkillDirectory,
  filterFrontmatterKeys,
  findPackageRoot,
  getConfigureMcp,
  getConfigureLsp,
  hasConfigureMcp,
  hasConfigureLsp,
  isUnderRoot,
  isWithin,
  listFiles,
  materializeSkill,
  primitivesList,
  primitivesMaterialize,
  pruneManagedMcpServerNames,
  readHookOwnershipSidecar,
  readPrimitiveContent,
  removeOwnedHookArtifacts,
  renderNativeHookEntries,
  renderPrimitivesMarkdown,
  sanitizeName,
  stripOwnedHookCommands,
  toPosixRel,
  writeDeployedFile,
  writeHookOwnershipSidecar,
} from "./helpers.ts";
