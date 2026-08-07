import { createTargetRegistry } from "bapm-integration-api";
import { createCursorTarget } from "bapm-integration-cursor";

/** Register the target packages shipped with the CLI distribution. */
export function createCliTargetRegistry() {
  const registry = createTargetRegistry();
  registry.register(createCursorTarget());
  return registry;
}
