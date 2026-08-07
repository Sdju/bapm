import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { loadLockfileOrNull } from "@/modules/Lockfile";
import { loadManifest } from "@/modules/Manifest";
import { APM_MODULES_DIR } from "@/modules/Resolver";
import type { DoctorCheck, DoctorResult, RunDoctorOptions } from "./types.ts";

const NETWORK_TIMEOUT_MS = 5000;
const NETWORK_LS_REMOTE_URL = "https://github.com/git/git.git";

type GitProbe = {
  ok: boolean;
  version?: string;
  reason?: string;
};

export async function runDoctor(options: RunDoctorOptions = {}): Promise<DoctorResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const verbose = Boolean(options.verbose);
  const checks: DoctorCheck[] = [];

  const git = probeGit(options);
  checks.push({
    name: "git",
    ok: git.ok,
    critical: true,
    message: formatGitMessage(git, verbose),
  });

  // Manifest if present
  try {
    const apm = join(cwd, "apm.yml");
    const bapm = join(cwd, "bapm.yml");
    if (existsSync(apm) || existsSync(bapm)) {
      const loaded = loadManifest({ cwd });
      const identity = `${loaded.document.name}@${loaded.document.version}`;
      checks.push({
        name: "manifest",
        ok: true,
        critical: true,
        message: verbose
          ? `manifest readable (${loaded.sourceFilename}: ${identity})`
          : "manifest readable",
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
      const depCount = lock.document.dependencies.length;
      checks.push({
        name: "lockfile",
        ok: true,
        critical: true,
        message: verbose
          ? `lockfile readable (${lock.sourceFilename}: lockfile_version=${lock.document.lockfile_version}, dependencies=${depCount})`
          : "lockfile readable",
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
  } else if (!existsSync(modules)) {
    checks.push({
      name: "modules",
      ok: true,
      critical: false,
      message: verbose ? `${APM_MODULES_DIR} absent (ok)` : `${APM_MODULES_DIR} ok`,
    });
  } else {
    const entryCount = readdirSync(modules).length;
    checks.push({
      name: "modules",
      ok: true,
      critical: false,
      message: verbose
        ? `${APM_MODULES_DIR} exists (${entryCount} entries)`
        : `${APM_MODULES_DIR} ok`,
    });
  }

  // Auth-env: always-on informational (names only, never secrets)
  checks.push(probeAuthEnv());

  // Network: verbose-only informational
  if (verbose) {
    checks.push(probeNetwork());
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

function formatGitMessage(git: GitProbe, verbose: boolean): string {
  if (!git.ok) {
    const reason = git.reason ?? "git is missing / not on PATH";
    if (verbose) {
      return `${reason} (critical)`;
    }
    return reason.includes("critical") ? reason : `${reason} (critical)`;
  }
  if (!verbose) {
    return "git is available on PATH";
  }
  if (git.version) {
    return `git is available on PATH (${git.version})`;
  }
  if (git.reason) {
    return `git is available on PATH (${git.reason})`;
  }
  return "git is available on PATH (availability confirmed)";
}

function probeGit(options: RunDoctorOptions): GitProbe {
  if (typeof options.gitAvailable === "boolean") {
    return options.gitAvailable
      ? { ok: true, reason: "availability overridden" }
      : { ok: false, reason: "git unavailable / missing (overridden)" };
  }
  if (typeof options.hasGit === "boolean") {
    return options.hasGit
      ? { ok: true, reason: "availability overridden" }
      : { ok: false, reason: "git unavailable / missing (overridden)" };
  }
  if (typeof options.whichGit === "function") {
    const v = options.whichGit();
    if (!v) {
      return { ok: false, reason: "git is missing / not on PATH" };
    }
    const version = tryGitVersion(String(v));
    return version ? { ok: true, version } : { ok: true, reason: `whichGit=${v}` };
  }
  if (typeof options.findGit === "function") {
    const v = options.findGit();
    if (!v) {
      return { ok: false, reason: "git is missing / not on PATH" };
    }
    const version = tryGitVersion(String(v));
    return version ? { ok: true, version } : { ok: true, reason: `findGit=${v}` };
  }
  try {
    const r = spawnSync("git", ["--version"], { encoding: "utf8" });
    if (r.status === 0) {
      const version = (r.stdout ?? "").trim() || "git --version ok";
      return { ok: true, version };
    }
    const errText = (r.stderr ?? r.stdout ?? "").trim();
    return {
      ok: false,
      reason: errText ? `git --version failed: ${errText}` : "git is missing / not on PATH",
    };
  } catch (err) {
    return {
      ok: false,
      reason: `git probe error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function tryGitVersion(gitBin: string): string | undefined {
  try {
    const r = spawnSync(gitBin, ["--version"], { encoding: "utf8" });
    if (r.status === 0) {
      const out = (r.stdout ?? "").trim();
      return out || undefined;
    }
  } catch {
    // ignore — fall back to path-only detail
  }
  return undefined;
}

function probeAuthEnv(): DoctorCheck {
  const set: string[] = [];
  if (process.env.GITHUB_TOKEN) set.push("GITHUB_TOKEN");
  if (process.env.GH_TOKEN) set.push("GH_TOKEN");
  return {
    name: "auth",
    ok: true,
    critical: false,
    message:
      set.length > 0
        ? `token env set: ${set.join(", ")} (values not shown)`
        : "GITHUB_TOKEN/GH_TOKEN not set",
  };
}

function probeNetwork(): DoctorCheck {
  try {
    const r = spawnSync("git", ["ls-remote", NETWORK_LS_REMOTE_URL, "HEAD"], {
      encoding: "utf8",
      timeout: NETWORK_TIMEOUT_MS,
    });
    if (r.error) {
      const code = (r.error as NodeJS.ErrnoException).code;
      if (code === "ETIMEDOUT" || code === "TIMEOUT") {
        return {
          name: "network",
          ok: false,
          critical: false,
          message: `git ls-remote timed out (≤${NETWORK_TIMEOUT_MS / 1000}s)`,
        };
      }
      return {
        name: "network",
        ok: false,
        critical: false,
        message: `network probe error: ${r.error.message}`,
      };
    }
    if (r.status === 0) {
      return {
        name: "network",
        ok: true,
        critical: false,
        message: `git ls-remote ${NETWORK_LS_REMOTE_URL} ok`,
      };
    }
    const detail = (r.stderr ?? r.stdout ?? `exit ${r.status}`).trim().slice(0, 200);
    return {
      name: "network",
      ok: false,
      critical: false,
      message: `git ls-remote failed: ${detail || `status ${r.status}`}`,
    };
  } catch (err) {
    return {
      name: "network",
      ok: false,
      critical: false,
      message: `network probe error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
