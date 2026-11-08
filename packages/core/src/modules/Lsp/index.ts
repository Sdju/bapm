/**
 * Lsp — collect LSP server declarations, validate native host capability, and
 * apply lock `lsp_*` inventory.
 *
 * ## Public API
 *
 * - `parseLspDeclarations` / `parseLspDeclaration` — fail-closed manifest parsing
 * - `collectLspServers` — root + dependency LSP collection
 * - `applyLspInventoryToLock` / `readLspTargetInventory` — lock inventory
 *
 * ## Example
 *
 * ```ts
 * import { collectLspServers, applyLspInventoryToLock } from "@/modules/Lsp";
 * const { servers } = collectLspServers({ rootManifest, nodes });
 * applyLspInventoryToLock({ document, servers, targetServers: { claude: ["gopls"] } });
 * ```
 */

export type {
  ApplyLspInventoryOptions,
  CollectedLspServer,
  CollectLspServersOptions,
  CollectLspServersResult,
  LspDeclarationContext,
  ParsedLspServer,
} from "./types.ts";

export { parseLspDeclaration, parseLspDeclarations, LspDeclarationError } from "./parse.ts";
export { collectLspServers } from "./collect.ts";
export { applyLspInventoryToLock, readLspTargetInventory } from "./lockInventory.ts";
