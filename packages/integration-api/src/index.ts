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
  assertUnderDeployRoots,
  copyPortableSkillDirectory,
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
  sanitizeName,
  toPosixRel,
} from "./helpers.ts";
