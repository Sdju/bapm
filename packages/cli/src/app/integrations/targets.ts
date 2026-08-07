import { createTargetRegistry } from "bapm-target-api";
import { createCursorTarget } from "bapm-target-cursor";

/** Register the target packages shipped with the CLI distribution. */
export function createCliTargetRegistry() {
  const registry = createTargetRegistry();
  registry.register(createCursorTarget());
  return registry;
}
