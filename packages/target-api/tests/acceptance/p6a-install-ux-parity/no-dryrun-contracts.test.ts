/**
 * p6a: target-api contracts must not grow dryRun on write ports.
 * Spec: target-api-contracts.
 */
import { expect, test, describe } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("target-api p6a no dryRun on target contracts", () => {
  test("MaterializeContext / ConfigureMcpContext / BapmTarget omit dryRun", () => {
    const typesSrc = readFileSync(join(pkgRoot, "src/types.ts"), "utf8");

    expect(typesSrc).toMatch(/export type MaterializeContext/);
    expect(typesSrc).toMatch(/export type ConfigureMcpContext/);
    expect(typesSrc).toMatch(/export type BapmTarget/);

    // dryRun must not appear on target write-port contracts.
    const materializeBlock = typesSrc.slice(
      typesSrc.indexOf("export type MaterializeContext"),
      typesSrc.indexOf("export type DeployedFile"),
    );
    const configureBlock = typesSrc.slice(
      typesSrc.indexOf("export type ConfigureMcpContext"),
      typesSrc.indexOf("export type ConfigureMcpReport"),
    );
    const targetBlock = typesSrc.slice(typesSrc.indexOf("export type BapmTarget"));

    expect(materializeBlock).not.toMatch(/\bdryRun\b/);
    expect(configureBlock).not.toMatch(/\bdryRun\b/);
    expect(targetBlock).not.toMatch(/\bdryRun\b/);
  });
});
