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

export {
  assertUnderDeployRoots,
  getConfigureMcp,
  hasConfigureMcp,
  isUnderRoot,
  primitivesList,
  readPrimitiveContent,
  sanitizeName,
  toPosixRel,
} from "./helpers.ts";
