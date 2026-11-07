/**
 * Render a CLI error message plus its nested `cause` chain.
 *
 * Non-verbose output stays a single line so existing command output is stable;
 * `-v` appends indented `cause:` lines. Chains are bounded by `maxDepth` and
 * guarded against cycles (a cause can reference an ancestor).
 */

export interface FormatErrorCauseChainOptions {
  /** Include indented `cause:` lines for the nested chain (default false). */
  verbose?: boolean;
  /** Override the rendered top-level message (e.g. after message enrichment). */
  message?: string;
  /** Maximum number of cause entries rendered (default 5). */
  maxDepth?: number;
  /** Prefix before each `cause:` label (default two spaces). */
  indent?: string;
}

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_INDENT = "  ";
const CAUSE_LABEL = "cause";
const CAUSE_INDENT_CONTINUATION = "  ";

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    try {
      return Object.prototype.toString.call(value);
    } catch {
      return "[unprintable value]";
    }
  }
}

/** Best-effort message for Errors, error-like objects, strings, and primitives. */
export function formatErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (isObjectLike(value)) {
    try {
      if ("message" in value) {
        return safeString((value as { message?: unknown }).message);
      }
    } catch {
      // Hostile getter/proxy: fall through to a generic rendering.
    }
  }
  return safeString(value);
}

function causeOf(value: unknown): { present: true; cause: unknown } | { present: false } {
  if (!isObjectLike(value)) return { present: false };
  try {
    if (!("cause" in value)) return { present: false };
    return { present: true, cause: (value as { cause?: unknown }).cause };
  } catch {
    return { present: false };
  }
}

function renderCause(value: unknown, indent: string): string {
  const lines = formatErrorMessage(value).split(/\r?\n/);
  const [first = "", ...rest] = lines;
  const continuation = `${indent}${CAUSE_INDENT_CONTINUATION}`;
  return [
    `${indent}${CAUSE_LABEL}: ${first}`,
    ...rest.map((line) => `${continuation}${line}`),
  ].join("\n");
}

/**
 * Format `error` for terminal output.
 *
 * @example
 * formatErrorCauseChain(err, { verbose: true })
 * // "Failed to download https://…\n  cause: Local path not found: skills/frontend-design"
 */
export function formatErrorCauseChain(
  error: unknown,
  options: FormatErrorCauseChainOptions = {},
): string {
  const rootMessage = options.message ?? formatErrorMessage(error);
  if (!options.verbose) return rootMessage;

  const maxDepth =
    options.maxDepth !== undefined && Number.isFinite(options.maxDepth)
      ? Math.max(0, Math.floor(options.maxDepth))
      : DEFAULT_MAX_DEPTH;
  if (maxDepth === 0) return rootMessage;

  const indent = options.indent ?? DEFAULT_INDENT;
  const visited = new WeakSet<object>();
  if (isObjectLike(error)) visited.add(error);

  const lines = [rootMessage];
  let current: unknown = error;
  let depth = 0;

  for (;;) {
    const link = causeOf(current);
    if (!link.present) break;

    const cause = link.cause;
    if (cause === undefined || cause === null) break;

    if (isObjectLike(cause) && visited.has(cause)) {
      lines.push(`${indent}${CAUSE_LABEL}: [circular cause]`);
      break;
    }

    if (depth >= maxDepth) {
      lines.push(`${indent}${CAUSE_LABEL}: [cause chain truncated after ${maxDepth} level(s)]`);
      break;
    }

    if (isObjectLike(cause)) visited.add(cause);
    lines.push(renderCause(cause, indent));
    current = cause;
    depth += 1;
  }

  return lines.join("\n");
}
