/**
 * bapm-integration-api — contracts + registry between @bapm/core and host targets.
 */

export type {
  AttributedPrimitive,
  AttributedPrimitiveSet,
  BapmTarget,
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
  TargetRegistry,
} from "./types.ts";

export {
  createTargetRegistry,
  createRegistry,
  createMarketplaceOutputRegistry,
} from "./registry.ts";

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
