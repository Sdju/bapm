import { expect, test } from "vite-plus/test";
import { runCli } from "../src/index.ts";

test("runCli version", async () => {
  const logs: string[] = [];
  const original = console.log;
  console.log = (msg?: unknown) => {
    logs.push(String(msg));
  };
  try {
    const code = await runCli(["version"]);
    expect(code).toBe(0);
    expect(logs[0]).toMatch(/^bapm /);
  } finally {
    console.log = original;
  }
});
