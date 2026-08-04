import { YamlError } from "@/common/yaml/errors.ts";
import { loadYamlDocument as loadYamlDocumentCommon } from "@/common/yaml/loadDocument.ts";
import { ManifestError } from "./errors.ts";

/**
 * Public YAML loader for Manifest consumers.
 * Wraps common safe-subset loader and maps YamlError → ManifestError.
 */
export function loadYamlDocument(source: string, sourcePath?: string): unknown {
  try {
    return loadYamlDocumentCommon(source, sourcePath);
  } catch (cause) {
    if (cause instanceof YamlError) {
      const code =
        cause.code === "YAML_SAFE_SUBSET" ? "MANIFEST_YAML_SAFE_SUBSET" : "MANIFEST_YAML_PARSE";
      throw new ManifestError(code, cause.message, {
        path: sourcePath ?? cause.path,
        cause,
      });
    }
    throw cause;
  }
}
