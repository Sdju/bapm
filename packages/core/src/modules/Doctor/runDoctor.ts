import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { loadLockfileOrNull } from "@/modules/Lockfile";
import { loadManifest } from "@/modules/Manifest";
import { APM_MODULES_DIR } from "@/modules/Resolver";
import type { DoctorCheck, DoctorResult, RunDoctorOptions } from "./types.ts";

export async function runDoctor(options: RunDoctorOptions = {}): Promise<DoctorResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const checks: DoctorCheck[] = [];

  const gitOk = probeGit(options);
  checks.push({
    name: "git",
    ok: gitOk,
    critical: true,
    message: gitOk ? "git is available on PATH" : "git is missing / not on PATH (critical)",
  });

  // Manifest if present
  try {
    const apm = join(cwd, "apm.yml");
    const bapm = join(cwd, "bapm.yml");
    if (existsSync(apm) || existsSync(bapm)) {
      loadManifest({ cwd });
      checks.push({
        name: "manifest",
        ok: true,
        critical: true,
        message: "manifest readable",
      });
    } else {
      checks.push({
        name: "manifest",
        ok: true,
        critical: false,
        message: "manifest absent (ok)",
      });
    }
  } catch (err) {
    checks.push({
      name: "manifest",
      ok: false,
      critical: true,
      message: `manifest unreadable: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Lock if present
  try {
    const lock = loadLockfileOrNull({ cwd });
    if (lock) {
      checks.push({
        name: "lockfile",
        ok: true,
        critical: true,
        message: "lockfile readable",
      });
    } else {
      checks.push({
        name: "lockfile",
        ok: true,
        critical: false,
        message: "lockfile absent (ok)",
      });
    }
  } catch (err) {
    checks.push({
      name: "lockfile",
      ok: false,
      critical: true,
      message: `lockfile unreadable: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Modules dir sanity
  const modules = join(cwd, APM_MODULES_DIR);
  if (existsSync(modules) && !statSync(modules).isDirectory()) {
    checks.push({
      name: "modules",
      ok: false,
      critical: true,
      message: `${APM_MODULES_DIR} exists but is not a directory`,
    });
  } else {
    checks.push({
      name: "modules",
      ok: true,
      critical: false,
      message: `${APM_MODULES_DIR} ok`,
    });
  }

  const criticalFail = checks.some((c) => c.critical && !c.ok);
  const text = checks.map((c) => `${c.ok ? "PASS" : "FAIL"}\t${c.name}\t${c.message}`).join("\n");

  return {
    ok: !criticalFail,
    exitCode: criticalFail ? 1 : 0,
    checks,
    text,
  };
}

export const doctor = runDoctor;
export const checkDoctor = runDoctor;

function probeGit(options: RunDoctorOptions): boolean {
  if (typeof options.gitAvailable === "boolean") return options.gitAvailable;
  if (typeof options.hasGit === "boolean") return options.hasGit;
  if (typeof options.whichGit === "function") {
    const v = options.whichGit();
    return Boolean(v);
  }
  if (typeof options.findGit === "function") {
    const v = options.findGit();
    return Boolean(v);
  }
  try {
    const r = spawnSync("git", ["--version"], { encoding: "utf8" });
    return r.status === 0;
  } catch {
    return false;
  }
}
