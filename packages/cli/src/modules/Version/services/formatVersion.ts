export interface VersionContentDeps {
  name: string;
  getVersion: () => string;
}

export function formatVersion(deps: VersionContentDeps): string {
  return `${deps.name} ${deps.getVersion()}`;
}
