/**
 * plugin-scaffold — kebab-case plugin name + path-safe project name validation.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  acceptsName,
  getValidatePluginName,
  getValidateProjectName,
} from "./helpers.ts";

describe("mp-plugin-init plugin name validation", () => {
  test("valid kebab-case accepted", () => {
    const validate = getValidatePluginName();
    expect(acceptsName(validate, "my-plugin")).toBe(true);
    expect(acceptsName(validate, "a")).toBe(true);
    expect(acceptsName(validate, "demo-plugin-01")).toBe(true);
  });

  test("uppercase rejected", () => {
    const validate = getValidatePluginName();
    expect(acceptsName(validate, "MyPlugin")).toBe(false);
  });

  test("underscore / leading digit / leading hyphen / empty rejected", () => {
    const validate = getValidatePluginName();
    expect(acceptsName(validate, "my_plugin")).toBe(false);
    expect(acceptsName(validate, "1bad")).toBe(false);
    expect(acceptsName(validate, "-bad")).toBe(false);
    expect(acceptsName(validate, "")).toBe(false);
  });

  test("too long (>64) rejected", () => {
    const validate = getValidatePluginName();
    const long = `a${"b".repeat(64)}`;
    expect(long.length).toBeGreaterThan(64);
    expect(acceptsName(validate, long)).toBe(false);
  });

  test("project name rejects path separators and ..", () => {
    const validate = getValidateProjectName();
    expect(acceptsName(validate, "my-plugin")).toBe(true);
    expect(acceptsName(validate, "foo/bar")).toBe(false);
    expect(acceptsName(validate, "foo\\bar")).toBe(false);
    expect(acceptsName(validate, "..")).toBe(false);
    expect(acceptsName(validate, "foo/../bar")).toBe(false);
  });
});
