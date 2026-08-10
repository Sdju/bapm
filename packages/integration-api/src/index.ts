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
  DeployedFile,
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

export type {
  CopyHookScriptArgs,
  CopyHookScriptResult,
  HookOwnershipSidecar,
  PrimitiveMaterializeContext,
  PrimitiveMaterializeHandler,
  PrimitiveMaterializeHandlers,
  PrimitiveMaterializeKind,
} from "./helpers.ts";

export {
  SHARED_COMMAND_FRONTMATTER_KEYS,
  assertUnderDeployRoots,
  compileMarkdownReport,
  copyHookScript,
  copyPortableSkillDirectory,
  filterFrontmatterKeys,
  findPackageRoot,
  getConfigureMcp,
  hasConfigureMcp,
  isUnderRoot,
  isWithin,
  listFiles,
  materializeSkill,
  primitivesList,
  primitivesMaterialize,
  readHookOwnershipSidecar,
  readPrimitiveContent,
  removeOwnedHookArtifacts,
  renderPrimitivesMarkdown,
  sanitizeName,
  stripOwnedHookCommands,
  toPosixRel,
  writeDeployedFile,
  writeHookOwnershipSidecar,
} from "./helpers.ts";
