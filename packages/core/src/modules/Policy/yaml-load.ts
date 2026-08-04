import { YamlError } from "@/common/yaml/errors.ts";
import { loadYamlDocument as loadYamlDocumentCommon } from "@/common/yaml/loadDocument.ts";
import { PolicyError } from "./errors.ts";

/**
 * Public YAML loader for Policy consumers.
 * Wraps common safe-subset loader and maps YamlError → PolicyError.
 */
export function loadYamlDocument(source: string, sourcePath?: string): unknown {
  try {
    return loadYamlDocumentCommon(source, sourcePath);
  } catch (cause) {
    if (cause instanceof YamlError) {
      const code =
        cause.code === "YAML_SAFE_SUBSET" ? "POLICY_YAML_SAFE_SUBSET" : "POLICY_YAML_PARSE";
      throw new PolicyError(code, cause.message, {
        path: sourcePath ?? cause.path,
        cause,
      });
    }
    throw cause;
  }
}
