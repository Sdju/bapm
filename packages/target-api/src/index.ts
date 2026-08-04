/**
 * bapm-target-api — contracts + registry between @bapm/core and host targets.
 */

export type {
  AttributedPrimitive,
  AttributedPrimitiveSet,
  BapmTarget,
  ConfigureMcpContext,
  ConfigureMcpFn,
  ConfigureMcpReport,
  DeployedFile,
  MaterializeContext,
  MaterializeReport,
  McpServerConfig,
  PrimitiveSource,
  PrimitiveType,
  TargetDetectFn,
  TargetId,
  TargetRegistry,
} from "./types.ts";

export { createTargetRegistry, createRegistry } from "./registry.ts";

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
