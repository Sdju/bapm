/**
 * @bapm/integration-api — contracts + registry between @bapm/core and host integrations.
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
  PrimitiveMaterializeContext,
  PrimitiveMaterializeHandler,
  PrimitiveMaterializeHandlers,
  PrimitiveMaterializeKind,
} from "./helpers.ts";

export {
  SHARED_COMMAND_FRONTMATTER_KEYS,
  assertUnderDeployRoots,
  compileMarkdownReport,
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
  readPrimitiveContent,
  renderPrimitivesMarkdown,
  sanitizeName,
  toPosixRel,
  writeDeployedFile,
} from "./helpers.ts";
