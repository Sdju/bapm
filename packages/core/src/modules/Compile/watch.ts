/**
 * `compile --watch` main loop.
 *
 * The loop is deliberately transport-agnostic: it performs one initial compile,
 * then asks a watch factory to report changed paths and recompiles after a
 * debounce window. The CLI supplies the compile callback (registry selection,
 * target output and status printing stay there); tests can inject a factory or
 * run the loop in `once` mode without opening any real watchers.
 */
import { statSync, watch as fsWatch, type FSWatcher } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { effectiveDirectDeps, loadManifest } from "@/modules/Manifest";
import { APM_MODULES_DIR, DEFAULT_LOCAL_ROOT, classifyDependencyRef } from "@/modules/Resolver";

/** Default coalescing window for filesystem events. */
export const DEFAULT_COMPILE_WATCH_DEBOUNCE_MS = 200;

/**
 * One filesystem input. Directories are watched recursively by default; files
 * (and paths that do not exist yet) use a parent-directory watcher filtered by
 * name, so a replaced or newly created file is still observed.
 */
export type CompileWatchTarget = {
  /** Absolute path to a file or directory. */
  path: string;
  /** Recursively watch a directory. Defaults to true. */
  recursive?: boolean;
  /** Optional filename filter for directory watchers. */
  match?: (filename: string | null) => boolean;
};

export type CompileWatchHandle = {
  close(): void | Promise<void>;
};

export type CompileWatchFactoryOptions = {
  cwd: string;
  targets: CompileWatchTarget[];
  /** Called for every relevant filesystem event (before debouncing). */
  onChange: (paths: string[]) => void;
  onError?: (error: Error) => void;
};

export type CompileWatchFactory = (options: CompileWatchFactoryOptions) => CompileWatchHandle;

export type CompileWatchOptions = {
  /** Manifest/input root to watch. */
  cwd?: string;
  /**
   * Root for compile outputs when it differs from the input root. A global
   * compile watches `~/.bapm` but writes under the user home.
   */
  deployCwd?: string;
  /**
   * Performs one full compile. Throwing is safe: the loop reports the error and
   * keeps watching instead of exiting.
   */
  compile: () => Promise<unknown>;
  /** Injectable watcher used by tests. Defaults to `node:fs.watch`. */
  watchFactory?: CompileWatchFactory;
  /** Debounce window in milliseconds; defaults to 200. */
  debounceMs?: number;
  /** Resolve the inputs to watch; defaults to `resolveCompileWatchTargets`. */
  resolveTargets?: (cwd: string) => CompileWatchTarget[];
  /** Run the initial compile and return without opening a watcher. */
  once?: boolean;
  /** Stops the loop cleanly; the CLI wires SIGINT/SIGTERM to one of these. */
  signal?: AbortSignal;
  /** Concise progress line sink; defaults to `console.log`. */
  onStatus?: (message: string) => void;
  /** Compile/watch error sink; defaults to `console.error`. */
  onError?: (error: unknown) => void;
};

export type CompileWatchResult = {
  /** Number of compile attempts, including failed ones. */
  runs: number;
  /** Number of failed compile attempts. */
  errors: number;
  stopped: "signal" | "once";
};

/** Resolve the project inputs that can change compile output. */
export function resolveCompileWatchTargets(cwd: string = process.cwd()): CompileWatchTarget[] {
  const root = resolve(cwd);
  const targets: CompileWatchTarget[] = [
    // Project-root files: manifests, SKILL.md and *.prompt.md. Filtering avoids
    // feedback loops from compile's own AGENTS.md / CLAUDE.md writes.
    {
      path: root,
      recursive: false,
      match: (filename) => filename === null || isRootCompileInput(filename),
    },
    { path: join(root, ".apm"), recursive: true },
    { path: join(root, APM_MODULES_DIR), recursive: true },
    { path: join(root, "skills"), recursive: true },
    { path: join(root, "hooks"), recursive: true },
    { path: join(root, DEFAULT_LOCAL_ROOT), recursive: true },
  ];

  for (const localPath of localDependencyPaths(root)) {
    // Local deps escaping the project are rejected by resolve/compile; do not
    // watch outside the project root.
    if (isContained(root, localPath)) targets.push({ path: localPath, recursive: true });
  }
  return dedupeTargets(targets);
}

function isContained(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function isRootCompileInput(filename: string): boolean {
  if (/^(?:apm|bapm)\.ya?ml$/i.test(filename)) return true;
  if (/^(?:apm|bapm)\.local\.ya?ml$/i.test(filename)) return true;
  if (/^SKILL\.md$/i.test(filename)) return true;
  if (/\.prompt\.md$/i.test(filename)) return true;
  // Creating/removing a watched directory is a relevant input change.
  return ["apm_modules", "skills", "hooks", ".apm", ".agents"].includes(filename);
}

function localDependencyPaths(cwd: string): string[] {
  let document;
  try {
    document = loadManifest({ cwd }).document;
  } catch {
    // A broken manifest still gets watched through the root manifest target.
    return [];
  }

  const paths = new Set<string>();
  const deps = effectiveDirectDeps(document);
  for (const lists of [deps.dependencies, deps.devDependencies]) {
    for (const entry of lists?.apm ?? []) {
      try {
        const classified = classifyDependencyRef(entry);
        if (classified.kind === "local" && classified.path) {
          paths.add(resolve(cwd, classified.path));
        }
      } catch {
        // Invalid entries are compile's problem; watch only what resolves.
      }
    }
  }
  return [...paths];
}

function dedupeTargets(targets: CompileWatchTarget[]): CompileWatchTarget[] {
  const seen = new Set<string>();
  const out: CompileWatchTarget[] = [];
  for (const target of targets) {
    const key = `${resolve(target.path)}\0${target.recursive !== false}\0${target.match ? "match" : "all"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(target);
  }
  return out;
}

type WatchEntry = {
  watcher: FSWatcher;
};

/**
 * Default watcher built on `node:fs.watch`. Directory targets are recursive;
 * file and missing targets watch the nearest existing ancestor and filter by
 * relative name so atomic saves and later creation are both observed.
 */
export const createNodeCompileWatchFactory: CompileWatchFactory = (
  options: CompileWatchFactoryOptions,
): CompileWatchHandle => {
  const entries: WatchEntry[] = [];
  const reportError = (error: unknown): void => {
    options.onError?.(error instanceof Error ? error : new Error(String(error)));
  };

  const emit = (target: CompileWatchTarget, dir: string, filename: string | null): void => {
    if (target.match && !target.match(filename)) return;
    options.onChange([filename ? join(dir, filename) : target.path]);
  };

  const addWatcher = (
    dir: string,
    recursive: boolean,
    listener: (filename: string | null) => void,
  ): void => {
    try {
      const watcher = fsWatch(dir, { recursive }, (_event, filename) => listener(filename));
      watcher.on("error", reportError);
      entries.push({ watcher });
    } catch (error) {
      reportError(error);
    }
  };

  for (const target of options.targets) {
    const abs = resolve(target.path);
    let isDirectory = false;
    try {
      isDirectory = statSync(abs).isDirectory();
    } catch {
      isDirectory = false;
    }

    if (isDirectory) {
      addWatcher(abs, target.recursive !== false, (filename) => emit(target, abs, filename));
      continue;
    }

    const parent = nearestExistingParent(abs);
    const wanted = relative(parent, abs);
    const firstSegment = wanted.split(sep)[0] ?? wanted;
    addWatcher(parent, false, (filename) => {
      if (filename !== null && filename !== wanted && filename !== basename(wanted)) {
        if (filename !== firstSegment) return;
      }
      emit(target, parent, filename);
    });
  }

  return {
    close() {
      for (const entry of entries) {
        try {
          entry.watcher.close();
        } catch {
          // Already closed.
        }
      }
      entries.length = 0;
    },
  };
};

function nearestExistingParent(path: string): string {
  let current = path;
  while (true) {
    const parent = dirname(current);
    if (parent === current) return parent;
    try {
      if (statSync(parent).isDirectory()) return parent;
    } catch {
      // Keep walking up.
    }
    current = parent;
  }
}

/**
 * Run compile once, then recompile on relevant input changes.
 *
 * - compile errors are reported and do not stop the loop;
 * - a run already in flight absorbs further events into one follow-up run;
 * - `signal` (Ctrl+C wiring lives in the CLI) closes the watcher and resolves.
 */
export async function watchCompile(options: CompileWatchOptions): Promise<CompileWatchResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const deployCwd = resolve(options.deployCwd ?? cwd);
  const debounceMs = options.debounceMs ?? DEFAULT_COMPILE_WATCH_DEBOUNCE_MS;
  const status = options.onStatus ?? ((message: string) => console.log(message));
  const reportError =
    options.onError ??
    ((error: unknown) =>
      console.error(`compile --watch: ${error instanceof Error ? error.message : String(error)}`));
  const resolveTargets = options.resolveTargets ?? resolveCompileWatchTargets;
  const watchEnabled = options.once !== true;

  let runs = 0;
  let errors = 0;
  let closed = false;
  let pending = false;
  let active: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watcher: CompileWatchHandle | undefined;
  let watcherKey = "";
  let watchedTargets = 0;
  const generatedOutputs = new Set<string>();

  const captureOutputs = (value: unknown): void => {
    if (value === null || typeof value !== "object") return;
    const outputs = (value as { outputs?: unknown }).outputs;
    if (!Array.isArray(outputs)) return;
    generatedOutputs.clear();
    for (const output of outputs) {
      if (output === null || typeof output !== "object") continue;
      const path = (output as { path?: unknown }).path;
      if (typeof path === "string" && path.trim()) generatedOutputs.add(resolve(deployCwd, path));
    }
  };

  let resolveStopped!: (result: CompileWatchResult) => void;
  const stoppedPromise = new Promise<CompileWatchResult>((resolve) => {
    resolveStopped = resolve;
  });
  let stopping: Promise<CompileWatchResult> | undefined;

  const closeWatcher = async (): Promise<void> => {
    const current = watcher;
    watcher = undefined;
    watcherKey = "";
    if (!current) return;
    try {
      await current.close();
    } catch (error) {
      reportError(error);
    }
  };

  const stop = (reason: CompileWatchResult["stopped"]): Promise<CompileWatchResult> => {
    if (stopping) return stopping;
    closed = true;
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    options.signal?.removeEventListener("abort", aborted);
    pending = false;
    stopping = (async () => {
      await active?.catch(() => undefined);
      await closeWatcher();
      if (watchEnabled) status("compile --watch: stopped");
      const result: CompileWatchResult = { runs, errors, stopped: reason };
      resolveStopped(result);
      return result;
    })();
    return stopping;
  };

  function aborted(): void {
    void stop("signal");
  }

  if (options.signal) {
    if (options.signal.aborted) void stop("signal");
    else options.signal.addEventListener("abort", aborted, { once: true });
  }

  const refreshWatcher = async (): Promise<void> => {
    if (!watchEnabled || closed) return;
    let targets: CompileWatchTarget[];
    try {
      targets = resolveTargets(cwd);
    } catch (error) {
      reportError(error);
      return;
    }
    const key = targets
      .map((target) => `${resolve(target.path)}\0${target.recursive !== false}`)
      .join("\n");
    watchedTargets = targets.length;
    if (watcher && watcherKey === key) return;

    await closeWatcher();
    if (closed) return;
    try {
      watcher = (options.watchFactory ?? createNodeCompileWatchFactory)({
        cwd,
        targets,
        onChange: (paths) => {
          if (closed) return;
          // Ignore compile's own writes when an output lives under a watched
          // input root (for example distributed `skills/AGENTS.md`). Global
          // outputs resolve against the deploy root, which may be outside the
          // watched manifest root entirely.
          const isGenerated = (path: string): boolean =>
            generatedOutputs.has(resolve(path)) ||
            generatedOutputs.has(resolve(deployCwd, path)) ||
            generatedOutputs.has(resolve(cwd, path));
          const relevant = paths.filter((path) => !isGenerated(path));
          if (relevant.length > 0) schedule();
        },
        onError: reportError,
      });
      watcherKey = key;
    } catch (error) {
      reportError(error);
    }
  };

  const schedule = (): void => {
    if (closed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (closed) return;
      if (active) {
        pending = true;
        return;
      }
      trigger("change");
    }, debounceMs);
    // Never keep the event loop alive solely for a pending debounce.
    timer.unref?.();
  };

  const runBody = async (reason: "initial" | "change"): Promise<void> => {
    const isChange = reason === "change";
    if (isChange) status("compile --watch: change detected; recompiling…");
    try {
      const result = await options.compile();
      captureOutputs(result);
      runs += 1;
      if (isChange) status("compile --watch: recompiled");
    } catch (error) {
      runs += 1;
      errors += 1;
      reportError(error);
      if (watchEnabled) status("compile --watch: compile failed; still watching");
    }
  };

  const trigger = (reason: "initial" | "change"): void => {
    if (closed) return;
    if (active) {
      pending = true;
      return;
    }
    active = (async () => {
      await runBody(reason);
      await refreshWatcher();
    })().finally(() => {
      active = undefined;
      if (closed) return;
      if (pending) {
        pending = false;
        schedule();
      }
    });
  };

  trigger("initial");
  await active;
  if (options.once) return stop("once");
  if (options.signal?.aborted) return stop("signal");

  await refreshWatcher();
  if (!closed) {
    status(
      `compile --watch: watching manifest, .apm, apm_modules and local directories (${watchedTargets} input roots; Ctrl+C to stop)`,
    );
  }

  return stoppedPromise;
}
