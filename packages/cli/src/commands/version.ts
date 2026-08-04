import type { VersionApi } from "@/modules/Version";

export async function versionCommand(_argv: string[], version: VersionApi): Promise<number> {
  version.print();
  return 0;
}
