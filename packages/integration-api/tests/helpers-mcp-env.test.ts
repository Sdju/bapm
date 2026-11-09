import { describe, expect, test } from "vite-plus/test";
import {
  extractEnvReference,
  hasEnvReference,
  translateEnvMap,
  translateEnvReferences,
} from "../src/index.ts";

describe("translateEnvReferences", () => {
  test("dollar-env normalizes every authored form", () => {
    expect(translateEnvReferences("${API_TOKEN}", "dollar-env")).toBe("${env:API_TOKEN}");
    expect(translateEnvReferences("${env:API_TOKEN}", "dollar-env")).toBe("${env:API_TOKEN}");
    expect(translateEnvReferences("{env:API_TOKEN}", "dollar-env")).toBe("${env:API_TOKEN}");
    expect(translateEnvReferences("<API_TOKEN>", "dollar-env")).toBe("${env:API_TOKEN}");
    expect(translateEnvReferences("Bearer ${API_TOKEN}", "dollar-env")).toBe(
      "Bearer ${env:API_TOKEN}",
    );
    expect(translateEnvReferences("literal", "dollar-env")).toBe("literal");
  });

  test("brace-env emits OpenCode-native form", () => {
    expect(translateEnvReferences("${API_TOKEN}", "brace-env")).toBe("{env:API_TOKEN}");
    expect(translateEnvReferences("Bearer ${env:API_TOKEN}", "brace-env")).toBe(
      "Bearer {env:API_TOKEN}",
    );
  });

  test("dollar-bare emits ${VAR}", () => {
    expect(translateEnvReferences("${env:API_TOKEN}", "dollar-bare")).toBe("${API_TOKEN}");
    expect(translateEnvReferences("<API_TOKEN>", "dollar-bare")).toBe("${API_TOKEN}");
  });

  test("translateEnvMap preserves keys and non-env values", () => {
    expect(translateEnvMap({ API_TOKEN: "${API_TOKEN}", PLAIN: "literal" }, "dollar-env")).toEqual({
      API_TOKEN: "${env:API_TOKEN}",
      PLAIN: "literal",
    });
  });
});

describe("env reference detection", () => {
  test("hasEnvReference recognizes every authored form", () => {
    expect(hasEnvReference("${API_TOKEN}")).toBe(true);
    expect(hasEnvReference("${env:API_TOKEN}")).toBe(true);
    expect(hasEnvReference("{env:API_TOKEN}")).toBe(true);
    expect(hasEnvReference("<API_TOKEN>")).toBe(true);
    expect(hasEnvReference("literal")).toBe(false);
  });

  test("hasEnvReference also matches malformed references for fail-closed hosts", () => {
    expect(hasEnvReference("Bearer ${TOKEN-WITH-DASH}")).toBe(true);
    expect(hasEnvReference("${env:1BAD}")).toBe(true);
  });

  test("extractEnvReference only accepts a single whole-placeholder value", () => {
    expect(extractEnvReference("${API_TOKEN}")).toBe("API_TOKEN");
    expect(extractEnvReference("${env:API_TOKEN}")).toBe("API_TOKEN");
    expect(extractEnvReference("{env:API_TOKEN}")).toBe("API_TOKEN");
    expect(extractEnvReference("<API_TOKEN>")).toBe("API_TOKEN");
    expect(extractEnvReference("Bearer ${API_TOKEN}")).toBeUndefined();
    expect(extractEnvReference("literal")).toBeUndefined();
  });
});
