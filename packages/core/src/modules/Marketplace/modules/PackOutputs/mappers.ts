/** Serialize host-owned marketplace documents with stable formatting. */
export function serializeMarketplaceJson(doc: Record<string, unknown>): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}
