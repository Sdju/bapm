/**
 * User docs framing for canonical-host happy path (presence / contract checks).
 * Promoted from docs-host-happy-path acceptance.
 */
import { describe, expect, test } from "vite-plus/test";
import { docsExists, readDocs } from "../install/canonical-host-helpers.ts";

describe("docs · host happy-path framing", () => {
  test("quick-start Cursor happy path does not require targets: object-map first", () => {
    const text = readDocs("guide/quick-start.md");
    // Happy path: install finds agent → canonical package → materialize (map optional).
    expect(text).toMatch(/happy path|без targets|без object-map|canonical|стандартн/i);
    // Must not teach object-map as the only prerequisite for Cursor.
    expect(text).not.toMatch(/Cursor[\s\S]{0,200}объявить `targets:`/i);
    expect(text).not.toMatch(/\*\*Cursor\*\*[^\n]*object-map/i);
  });

  test("detect / active / targets formulated as three distinct concepts", () => {
    const hosts = readDocs("guide/manifest-hosts.md");
    const overlay = readDocs("guide/manifest-overlay.md");
    const blob = `${hosts}\n${overlay}`;
    expect(blob).toMatch(/\bdetect\b/i);
    expect(blob).toMatch(/\bactive\b/i);
    expect(blob).toMatch(/\btargets\b/i);
    // targets must not be described as activating hosts.
    expect(hosts).toMatch(/не активир|does not activate|сами по себе не активируют/i);
  });

  test("local overlay team scenario (shared base + personal active per agent) is present", () => {
    const overlay = readDocs("guide/manifest-overlay.md");
    expect(overlay).toMatch(/bapm\.local\.yml/);
    // Team/dev preference scenario: shared deps in base, each developer pins agent via local active.
    expect(overlay).toMatch(
      /Vasya|Masha|команд(а|ный)|team (base|policy|manifest)|общий bapm\.yml/i,
    );
    expect(overlay).toMatch(/active/);
    expect(overlay).toMatch(/Cursor|Claude|разн/i);
  });

  test("How host selection works page exists with precedence + separate map vs canonical", () => {
    const candidates = [
      "guide/host-selection.md",
      "guide/how-host-selection-works.md",
      "guide/selection.md",
    ];
    const hit = candidates.find((p) => docsExists(p));
    expect(hit, "expected a dedicated host-selection docs page").toBeTruthy();
    const text = readDocs(hit!);
    expect(text).toMatch(/--target/);
    expect(text).toMatch(/active/);
    expect(text).toMatch(/detect|auto-detect/i);
    expect(text).toMatch(/canonical|@b-apm\/integration-/i);
    expect(text).toMatch(/fail-closed|ambigu/i);
  });

  test("Supported Hosts table lists canonical package column (P1)", () => {
    const text = readDocs("guide/supported-hosts.md");
    expect(text).toMatch(/Canonical|каноническ|@b-apm\/integration-/i);
    expect(text).toMatch(/Auto-detect|auto-detect|Detect/i);
    // Happy path must not mandate targets: for every host row as the only path.
    expect(text).not.toMatch(/\|\s*\*\*Cursor\*\*\s*\|[^\n]*объявить `targets:`/i);
  });
});
