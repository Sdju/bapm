/**
 * marketplace-authoring-schema — req-mf-017 / APM SOURCE_RE accept & reject.
 */
import { describe, expect, test } from "vite-plus/test";
import { acceptsSource, getValidateAuthoringSource } from "./helpers.ts";

describe("mp-authoring-yml source validation", () => {
  test("accepts github owner/repo shorthand", () => {
    const validate = getValidateAuthoringSource();
    expect(acceptsSource(validate, "acme/tools")).toBe(true);
  });

  test("accepts host.tld/owner/repo and https remotes and local ./", () => {
    const validate = getValidateAuthoringSource();
    expect(acceptsSource(validate, "gitlab.com/acme/tools")).toBe(true);
    expect(acceptsSource(validate, "https://github.com/acme/tools")).toBe(true);
    expect(acceptsSource(validate, "./plugins/demo")).toBe(true);
  });

  test("rejects userinfo in source", () => {
    const validate = getValidateAuthoringSource();
    expect(acceptsSource(validate, "https://user:pass@github.com/acme/tools")).toBe(false);
  });

  test("rejects path traversal and bare relative local without ./", () => {
    const validate = getValidateAuthoringSource();
    expect(acceptsSource(validate, "../outside")).toBe(false);
    expect(acceptsSource(validate, "plugins/demo")).toBe(false);
  });

  test("rejects ports and query strings on remote sources", () => {
    const validate = getValidateAuthoringSource();
    expect(acceptsSource(validate, "https://github.com:8443/acme/tools")).toBe(false);
    expect(acceptsSource(validate, "https://github.com/acme/tools?raw=1")).toBe(false);
  });
});
