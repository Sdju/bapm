/**
 * marketplace-authoring-schema — detect preferred / legacy / both / none.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  detectKind,
  getDetectAuthoringConfigSource,
  join,
  type TempProject,
  validAuthoringBapmYml,
  writeBapmYml,
  writeText,
} from "./authoring-helpers.ts";

describe("mp-authoring-yml detect authoring config source", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("preferred bapm.yml marketplace block succeeds", () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validAuthoringBapmYml());
    const detect = getDetectAuthoringConfigSource();
    const result = detect({ cwd: project.cwd });
    const kind = detectKind(result).toLowerCase();
    expect(kind).toMatch(/bapm|preferred|block|yml/);
    expect(kind).not.toMatch(/both|none|missing|error/);
  });

  test("both bapm.yml block and marketplace.yml → hard error", () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validAuthoringBapmYml());
    writeText(
      join(project.cwd, "marketplace.yml"),
      [`owner: legacy-org`, `packages:`, `  - name: old`, `    source: ./old`, ``].join("\n"),
    );

    const detect = getDetectAuthoringConfigSource();
    let errored = false;
    let kind = "";
    try {
      const result = detect({ cwd: project.cwd });
      kind = detectKind(result).toLowerCase();
      errored =
        /both|conflict|error|ambiguous/.test(kind) ||
        (typeof result === "object" &&
          result !== null &&
          ("error" in result || (result as { ok?: boolean }).ok === false));
    } catch (e) {
      errored = true;
      kind = String(e);
    }
    expect(errored || /both|conflict|ambiguous/.test(kind)).toBe(true);
  });

  test("none → actionable message mentioning marketplace init", () => {
    project = createTempProject();
    writeBapmYml(project.cwd, `name: bare\nversion: "0.0.1"\n`);

    const detect = getDetectAuthoringConfigSource();
    let message = "";
    let kind = "";
    try {
      const result = detect({ cwd: project.cwd });
      kind = detectKind(result).toLowerCase();
      message = JSON.stringify(result);
    } catch (e) {
      message = String(e);
      kind = "error";
    }
    expect(/none|missing|absent|empty|error|init/.test(kind) || /init/i.test(message)).toBe(true);
    expect(message).toMatch(/marketplace\s+init|init/i);
  });
});
