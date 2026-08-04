/**
 * bapm-target-api — contracts + registry between @bapm/core and host targets.
 */

export type {
  AttributedPrimitive,
  AttributedPrimitiveSet,
  BapmTarget,
  DeployedFile,
  MaterializeContext,
  MaterializeReport,
  PrimitiveSource,
  PrimitiveType,
  TargetDetectFn,
  TargetId,
  TargetRegistry,
} from "./types.ts";

export { createTargetRegistry, createRegistry } from "./registry.ts";

export {
  assertUnderDeployRoots,
  isUnderRoot,
  primitivesList,
  readPrimitiveContent,
  sanitizeName,
  toPosixRel,
} from "./helpers.ts";
