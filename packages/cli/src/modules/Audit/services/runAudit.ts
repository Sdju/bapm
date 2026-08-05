import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  formatAuditCiJson,
  formatAuditCiSarif,
  runAuditCi as coreRunAuditCi,
  type AuditCiFormat,
} from "@bapm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type AuditOptions = { args?: string[]; cwd?: string };

const SUPPORTED_FORMATS = new Set<AuditCiFormat>(["text", "json", "sarif"]);

export type ParsedAuditArgs = {
  ci: boolean;
  help?: boolean;
  format?: AuditCiFormat;
  formatExplicit?: boolean;
  output?: string;
  error?: string;
};

export function detectFormatFromExtension(path: string): AuditCiFormat | "unsupported" {
  const lower = path.toLowerCase();
  if (lower.endsWith(".sarif.json") || lower.endsWith(".sarif")) return "sarif";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md")) return "unsupported";
  return "text";
}

export function resolveAuditFormat(parsed: ParsedAuditArgs): {
  format: AuditCiFormat;
  error?: string;
} {
  if (parsed.formatExplicit && parsed.format) {
    return { format: parsed.format };
  }
  if (parsed.output) {
    const detected = detectFormatFromExtension(parsed.output);
    if (detected === "unsupported") {
      return {
        format: "text",
        error: `Unsupported audit output extension for ${parsed.output} (markdown not accepted; use -f text|json|sarif)`,
      };
    }
    return { format: detected };
  }
  return { format: parsed.format ?? "text" };
}

export function parseAuditArgs(argv: string[]): ParsedAuditArgs {
  let ci = false;
  let format: AuditCiFormat | undefined;
  let formatExplicit = false;
  let output: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      return { ci, help: true, format, formatExplicit, output };
    }
    if (arg === "--ci") {
      ci = true;
      continue;
    }
    if (arg === "--format" || arg === "-f") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        return { ci, error: "missing value for --format / -f" };
      }
      const value = next.toLowerCase();
      if (!SUPPORTED_FORMATS.has(value as AuditCiFormat)) {
        return {
          ci,
          formatExplicit: true,
          output,
          error: `Unknown or unsupported audit format: ${next} (expected text|json|sarif)`,
        };
      }
      format = value as AuditCiFormat;
      formatExplicit = true;
      i += 1;
      continue;
    }
    if (arg.startsWith("--format=")) {
      const value = arg.slice("--format=".length).toLowerCase();
      if (!value) return { ci, error: "missing value for --format=" };
      if (!SUPPORTED_FORMATS.has(value as AuditCiFormat)) {
        return {
          ci,
          formatExplicit: true,
          output,
          error: `Unknown or unsupported audit format: ${value} (expected text|json|sarif)`,
        };
      }
      format = value as AuditCiFormat;
      formatExplicit = true;
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        return { ci, format, formatExplicit, error: "missing value for --output / -o" };
      }
      output = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--output=")) {
      output = arg.slice("--output=".length);
      if (!output) return { ci, format, formatExplicit, error: "missing value for --output=" };
      continue;
    }
    if (arg.startsWith("-")) {
      return { ci, format, formatExplicit, output, error: `Unknown audit flag: ${arg}` };
    }
    return { ci, format, formatExplicit, output, error: `Unexpected audit argument: ${arg}` };
  }

  return { ci, format, formatExplicit, output };
}

export function formatAuditHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} audit — Integrity checks

Usage:
  bapm audit --ci [-f text|json|sarif] [-o path]

Options:
  --ci              CI gate: lock present + deployed presence + hash re-verify
  -f, --format      Output format: text (default), json, or sarif
  -o, --output      Write report body to file (mkdir parents; body not on stdout)
`;
}

function serializeBody(
  format: AuditCiFormat,
  result: Awaited<ReturnType<typeof coreRunAuditCi>>,
): string {
  if (format === "json") return formatAuditCiJson(result);
  if (format === "sarif") return formatAuditCiSarif(result);
  return result.text;
}

export async function runAuditCli(
  deps: LifecycleCliDeps,
  options: AuditOptions,
): Promise<LifecycleResult> {
  const parsed = parseAuditArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatAuditHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }

  const resolved = resolveAuditFormat(parsed);
  if (resolved.error) {
    console.error(`${deps.name}: ${resolved.error}`);
    return { ok: false, exitCode: 1, message: resolved.error };
  }

  const format = resolved.format;

  try {
    const result = await coreRunAuditCi({
      cwd: options.cwd,
      ci: parsed.ci || true,
    });

    if (format === "text") {
      if (result.text) console.log(result.text);
      return { ok: result.ok, exitCode: result.exitCode };
    }

    const body = serializeBody(format, result).replace(/\n$/, "");

    if (parsed.output) {
      mkdirSync(dirname(parsed.output), { recursive: true });
      writeFileSync(parsed.output, `${body}\n`, "utf8");
      console.error(`Audit report written to ${parsed.output} (format=${format})`);
      return { ok: result.ok, exitCode: result.exitCode };
    }

    console.log(body);
    return { ok: result.ok, exitCode: result.exitCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
