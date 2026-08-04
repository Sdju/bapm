import { formatVersion, type VersionContentDeps } from "./services/formatVersion.ts";

export type { VersionContentDeps };

export interface VersionDeps extends VersionContentDeps {}

export function createVersion(deps: VersionDeps) {
  return {
    format(): string {
      return formatVersion(deps);
    },
    print(): void {
      console.log(formatVersion(deps));
    },
  };
}

export type VersionApi = ReturnType<typeof createVersion>;
