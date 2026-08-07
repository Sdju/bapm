import { homedir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import { ResolverError } from "./errors.ts";

type ResolveLocalPathOptions = {
  originalPath: string;
  fromDir: string;
  projectRoot: string;
};

/**
 * Resolves a local dependency lexically, before any filesystem operation.
 * Backslashes are manifest-path separators even when the host is POSIX.
 */
export function resolveLocalPath({
  originalPath,
  fromDir,
  projectRoot,
}: ResolveLocalPathOptions): string {
  const pathSyntax = originalPath.replaceAll("\\", "/");
  const target =
    pathSyntax === "~" || pathSyntax.startsWith("~/")
      ? resolve(homedir(), pathSyntax.slice(1))
      : isAbsolute(pathSyntax)
        ? resolve(pathSyntax)
        : resolve(fromDir, pathSyntax);
  const root = resolve(projectRoot);
  const targetRelativeToRoot = relative(root, target);

  if (
    targetRelativeToRoot !== "" &&
    (targetRelativeToRoot === ".." ||
      targetRelativeToRoot.startsWith("..\\") ||
      targetRelativeToRoot.startsWith("../") ||
      isAbsolute(targetRelativeToRoot))
  ) {
    throw new ResolverError(
      "LOCAL_PATH_ESCAPES_PROJECT_ROOT",
      `Local dependency path escapes project root: ${originalPath}`,
      {
        details: {
          originalPath,
          resolvedPath: target,
          projectRoot: root,
          declaringDirectory: resolve(fromDir),
        },
      },
    );
  }

  return target;
}
