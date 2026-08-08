/** Marketplace-output-only — no detect / materialize (invalid as map load target). */
export default {
  id: "x-acme-market",
  marketplaceOutput: {
    format: "acme-market",
    defaultOutput: ".acme/marketplace.json",
    map: () => ({ plugins: [] }),
  },
};
