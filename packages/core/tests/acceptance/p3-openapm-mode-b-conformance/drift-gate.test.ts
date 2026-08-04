/**
 * p3: statement drift gate — regenerate-and-diff (or equivalent) must exist
 * so committed CONFORMANCE.{md,json} cannot silently diverge from checklist.
 */
import { expect, test, describe } from "vite-plus/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  driftScriptCandidates,
  findExistingPath,
  readPackageJsonScripts,
  repoRoot,
  scriptsMentionConformance,
  specConformanceDir,
} from "./helpers.ts";

describe("p3 Mode B — statement drift gate", () => {
  test("generator or drift-check script is present in-repo", () => {
    const script = findExistingPath(driftScriptCandidates);
    const scriptsDir = join(repoRoot, "scripts");
    const scriptsDirHits =
      existsSync(scriptsDir) &&
      readdirSync(scriptsDir).some((name) => /conformance/i.test(name));

    const underSpec =
      existsSync(specConformanceDir) &&
      readdirSync(specConformanceDir).some((name) =>
        /gen.?statement|conformance|drift/i.test(name),
      );

    expect(
      Boolean(script) || scriptsDirHits || underSpec,
      `expected a conformance generator/drift script among: ${driftScriptCandidates.join(", ")} ` +
        `or under scripts/ / tests/spec-conformance/`,
    ).toBe(true);
  });

  test("package scripts or README wire regenerate + drift check", () => {
    const rootScripts = readPackageJsonScripts(join(repoRoot, "package.json"));
    const coreScripts = readPackageJsonScripts(join(repoRoot, "packages/core/package.json"));
    const mentioned =
      scriptsMentionConformance(rootScripts) || scriptsMentionConformance(coreScripts);

    const readmePath = join(specConformanceDir, "README.md");
    const readmeDocumentsDrift =
      existsSync(readmePath) &&
      /drift|regenerat|CONFORMANCE\.(md|json)|git diff/i.test(readFileSync(readmePath, "utf8"));

    expect(
      mentioned || Boolean(findExistingPath(driftScriptCandidates)) || readmeDocumentsDrift,
      "expected package script mentioning conformance OR drift script OR tests/spec-conformance README documenting regenerate+diff",
    ).toBe(true);
  });
});
