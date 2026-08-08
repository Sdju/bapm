/**
 * Acceptance (RED): object-map + legacy forms for target / targets.
 * OpenSpec change: manifest-target-integration-map
 * Spec: manifest-yaml-validate (object-map + mutual exclusion + mf-005 keys)
 */
import { describe, expect, test } from "vite-plus/test";
import { expectParseReject, parseOk } from "./helpers.ts";

const CURSOR_PKG = "@bapm/integration-cursor";
const CLAUDE_PKG = "@bapm/integration-claude";

describe("manifest-target-integration-map parse — accept object maps", () => {
  test("targets object map accepted and retained", () => {
    const doc = parseOk({
      targets: {
        cursor: CURSOR_PKG,
        claude: CLAUDE_PKG,
      },
    }) as Record<string, unknown>;

    expect(doc.targets).toEqual({
      cursor: CURSOR_PKG,
      claude: CLAUDE_PKG,
    });
  });

  test("target object map accepted and retained", () => {
    const doc = parseOk({
      target: { claude: CLAUDE_PKG },
    }) as Record<string, unknown>;

    expect(doc.target).toEqual({ claude: CLAUDE_PKG });
  });

  test("multi-key singular target map allowed (same validation as targets)", () => {
    const doc = parseOk({
      target: {
        cursor: CURSOR_PKG,
        claude: CLAUDE_PKG,
      },
    }) as Record<string, unknown>;

    expect(doc.target).toEqual({
      cursor: CURSOR_PKG,
      claude: CLAUDE_PKG,
    });
  });

  test("vendor mf-005 key accepted in object map", () => {
    const doc = parseOk({
      targets: { "x-acme-editor": "@acme/integration-editor" },
    }) as Record<string, unknown>;

    expect(doc.targets).toEqual({ "x-acme-editor": "@acme/integration-editor" });
  });

  test("package value may include optional @version text (opaque non-empty string)", () => {
    const doc = parseOk({
      targets: { cursor: "@bapm/integration-cursor@1.2.3" },
    }) as Record<string, unknown>;

    expect(doc.targets).toEqual({ cursor: "@bapm/integration-cursor@1.2.3" });
  });
});

describe("manifest-target-integration-map parse — legacy forms still accepted", () => {
  test("legacy target string accepted", () => {
    const doc = parseOk({ target: "cursor" }) as Record<string, unknown>;
    expect(doc.target).toBe("cursor");
  });

  test("legacy targets string array accepted", () => {
    const doc = parseOk({ targets: ["cursor", "claude"] }) as Record<string, unknown>;
    expect(doc.targets).toEqual(["cursor", "claude"]);
  });
});

describe("manifest-target-integration-map parse — reject invalid maps", () => {
  test("invalid map key rejected with named diagnostic", () => {
    const { message, path, details } = expectParseReject({
      targets: { "not-a-host": CURSOR_PKG },
    });
    expect(message).toMatch(/not-a-host/);
    expect(message).toMatch(/mf-005|target|token|invalid/i);
    const named =
      path?.includes("not-a-host") ||
      details?.token === "not-a-host" ||
      /targets\.not-a-host|targets\[["']?not-a-host/.test(String(path ?? ""));
    expect(named || /not-a-host/.test(message)).toBe(true);
  });

  test("empty string map value rejected", () => {
    const { message } = expectParseReject({
      targets: { cursor: "" },
    });
    expect(message).toMatch(/empty|non-empty|value|targets/i);
  });

  test("whitespace-only map value rejected after trim", () => {
    const { message } = expectParseReject({
      target: { cursor: "   " },
    });
    expect(message).toMatch(/empty|non-empty|value|target/i);
  });

  test("non-string map value rejected", () => {
    const { message } = expectParseReject({
      targets: { cursor: 42 },
    });
    expect(message).toMatch(/string|value|targets/i);
  });

  test("empty object map {} rejected for targets", () => {
    const { message } = expectParseReject({
      targets: {},
    });
    expect(message).toMatch(/empty|targets/i);
  });

  test("empty object map {} rejected for target", () => {
    const { message } = expectParseReject({
      target: {},
    });
    expect(message).toMatch(/empty|target/i);
  });

  test("targets as mixed array of strings and objects rejected", () => {
    const { message } = expectParseReject({
      targets: ["cursor", { claude: CLAUDE_PKG }],
    });
    expect(message).toMatch(/targets|string|array|object|mapping/i);
  });
});

describe("manifest-target-integration-map parse — mutual exclusion", () => {
  test("legacy target + legacy targets rejected", () => {
    const { message } = expectParseReject({
      target: "cursor",
      targets: ["claude"],
    });
    expect(message).toMatch(/both.*target.*targets|target.*and.*targets/i);
  });

  test("object-map target + object-map targets rejected", () => {
    const { message } = expectParseReject({
      target: { cursor: CURSOR_PKG },
      targets: { claude: CLAUDE_PKG },
    });
    expect(message).toMatch(/both.*target.*targets|target.*and.*targets/i);
  });

  test("legacy target + object-map targets rejected", () => {
    const { message } = expectParseReject({
      target: "cursor",
      targets: { claude: CLAUDE_PKG },
    });
    expect(message).toMatch(/both.*target.*targets|target.*and.*targets/i);
  });

  test("object-map target + legacy targets rejected", () => {
    const { message } = expectParseReject({
      target: { cursor: CURSOR_PKG },
      targets: ["claude"],
    });
    expect(message).toMatch(/both.*target.*targets|target.*and.*targets/i);
  });
});
