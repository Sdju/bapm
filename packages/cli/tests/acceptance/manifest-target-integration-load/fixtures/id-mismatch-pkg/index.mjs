/** Runtime-shaped integration whose id intentionally mismatches the map key. */
export function createIntegration() {
  return {
    id: "x-other-id",
    deployRoots: [".acme/skills"],
    detect: () => false,
    async materialize() {
      return { targetId: "x-other-id", deployedFiles: [] };
    },
  };
}
