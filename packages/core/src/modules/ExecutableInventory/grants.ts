import {
  loadUserExecutableGrants,
  userConfigJsonPath,
  type ExecutableGrantEntry,
  type UserExecutableStoreOptions,
} from "@/modules/ExecutableTrust";
import {
  EXECUTABLE_TYPE_ORDER,
  type ExecutableType,
  type UserExecutableGrantEntry,
  type UserExecutableGrantList,
} from "./types.ts";

/**
 * List user-local grants from `<configRoot>/config.json` in a stable order.
 * Read-only: the store loader never creates or rewrites the file.
 */
export function listUserExecutableGrants(
  options: UserExecutableStoreOptions = {},
): UserExecutableGrantList {
  const grants = loadUserExecutableGrants(options);
  const rows: UserExecutableGrantEntry[] = [];

  for (const [packageName, entry] of Object.entries(grants.allow)) {
    rows.push({ package: packageName, grant: "allow", types: typesOf(entry), source: "user" });
  }
  for (const [packageName, entry] of Object.entries(grants.deny)) {
    rows.push({ package: packageName, grant: "deny", types: typesOf(entry), source: "user" });
  }

  rows.sort((left, right) => {
    const byPackage = left.package.localeCompare(right.package);
    if (byPackage !== 0) return byPackage;
    return left.grant === right.grant ? 0 : left.grant === "allow" ? -1 : 1;
  });

  return {
    source: "user",
    path: userConfigJsonPath(options),
    present: grants.present,
    grants: rows,
  };
}

function typesOf(entry: ExecutableGrantEntry): string[] {
  const known = EXECUTABLE_TYPE_ORDER.filter((type) => Boolean(entry[type]));
  const extra = Object.keys(entry)
    .filter((key) => !EXECUTABLE_TYPE_ORDER.includes(key as ExecutableType))
    .filter((key) => Boolean(entry[key]))
    .sort((left, right) => left.localeCompare(right));
  return [...known, ...extra];
}
