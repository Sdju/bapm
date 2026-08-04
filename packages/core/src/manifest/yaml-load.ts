import { isAlias, isCollection, isScalar, parseDocument, visit } from "yaml";
import { ManifestError } from "./errors.ts";

const STANDARD_YAML_TAG_PREFIX = "tag:yaml.org,2002:";

/**
 * Parse YAML text with OpenAPM-strict safe-subset guards:
 * reject anchors, aliases, and custom tags (req-mf-020).
 */
export function loadYamlDocument(source: string, sourcePath?: string): unknown {
  let doc;
  try {
    doc = parseDocument(source, {
      uniqueKeys: false,
      // Keep string identity for unquoted scalars that look like versions when possible.
      strict: false,
    });
  } catch (cause) {
    throw new ManifestError(
      "MANIFEST_YAML_PARSE",
      `Invalid YAML syntax${sourcePath ? ` in ${sourcePath}` : ""}: ${cause instanceof Error ? cause.message : String(cause)}`,
      { path: sourcePath, cause },
    );
  }

  if (doc.errors.length > 0) {
    const first = doc.errors[0]!;
    throw new ManifestError(
      "MANIFEST_YAML_PARSE",
      `Invalid YAML syntax${sourcePath ? ` in ${sourcePath}` : ""}: ${first.message}`,
      { path: sourcePath, cause: first },
    );
  }

  let aliasOrAnchor: string | undefined;
  let customTag: string | undefined;

  visit(doc, {
    Alias(_key, node) {
      if (isAlias(node)) {
        aliasOrAnchor = `YAML alias (*${node.source}) is not allowed (OpenAPM safe subset)`;
        return visit.BREAK;
      }
    },
    Node(_key, node) {
      if (!node || typeof node !== "object") return;
      if ("anchor" in node && typeof node.anchor === "string" && node.anchor.length > 0) {
        aliasOrAnchor = `YAML anchor (&${node.anchor}) is not allowed (OpenAPM safe subset)`;
        return visit.BREAK;
      }
      if ("tag" in node && typeof node.tag === "string" && node.tag.length > 0) {
        if (!isStandardYamlTag(node.tag)) {
          customTag = `Custom YAML tag (${node.tag}) is not allowed (OpenAPM safe subset)`;
          return visit.BREAK;
        }
      }
    },
  });

  if (aliasOrAnchor) {
    throw new ManifestError("MANIFEST_YAML_SAFE_SUBSET", aliasOrAnchor, {
      path: sourcePath,
    });
  }
  if (customTag) {
    throw new ManifestError("MANIFEST_YAML_SAFE_SUBSET", customTag, {
      path: sourcePath,
    });
  }

  // Empty document
  if (doc.contents === null || doc.contents === undefined) {
    return null;
  }

  // Ensure root is mapping when we later validate; toJS for maps/seqs/scalars.
  if (isScalar(doc.contents) || isCollection(doc.contents) || isAlias(doc.contents)) {
    return doc.toJS();
  }

  return doc.toJS();
}

function isStandardYamlTag(tag: string): boolean {
  if (tag.startsWith(STANDARD_YAML_TAG_PREFIX)) return true;
  // Non-specific tags
  if (tag === "!" || tag === "?") return true;
  return false;
}
