import { runPolicyStatus, type PolicyStatusReport } from "@b-apm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type PolicyCliOptions = { args?: string[]; cwd?: string };

export type ParsedPolicyArgs = {
  subcommand?: "status";
  json: boolean;
  check: boolean;
  noPolicy: boolean;
  policyPath?: string;
  help?: boolean;
  error?: string;
};

export function parsePolicyArgs(argv: string[]): ParsedPolicyArgs {
  let subcommand: "status" | undefined;
  let json = false;
  let check = false;
  let noPolicy = false;
  let policyPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      return { subcommand, json, check, noPolicy, policyPath, help: true };
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--check") {
      check = true;
      continue;
    }
    if (arg === "--no-policy") {
      noPolicy = true;
      continue;
    }
    if (arg === "--policy") {
      const next = argv[++i];
      if (!next || next.startsWith("-")) {
        return {
          subcommand,
          json,
          check,
          noPolicy,
          error: "Missing value for --policy <path>",
        };
      }
      policyPath = next;
      continue;
    }
    if (arg.startsWith("--policy=")) {
      policyPath = arg.slice("--policy=".length);
      if (!policyPath) {
        return {
          subcommand,
          json,
          check,
          noPolicy,
          error: "Missing value for --policy=<path>",
        };
      }
      continue;
    }
    if (arg.startsWith("-")) {
      return {
        subcommand,
        json,
        check,
        noPolicy,
        policyPath,
        error: `Unknown policy flag: ${arg}`,
      };
    }
    if (arg === "status") {
      if (subcommand) {
        return {
          subcommand,
          json,
          check,
          noPolicy,
          policyPath,
          error: `Unexpected policy argument: ${arg}`,
        };
      }
      subcommand = "status";
      continue;
    }
    return {
      subcommand,
      json,
      check,
      noPolicy,
      policyPath,
      error: `Unknown policy subcommand: ${arg}`,
    };
  }

  if (!subcommand) {
    return {
      json,
      check,
      noPolicy,
      policyPath,
      error: "Usage: bapm policy status [--json] [--policy <path>] [--no-policy] [--check]",
    };
  }
  return { subcommand, json, check, noPolicy, policyPath };
}

export function formatPolicyHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} policy — Inspect governance policy posture

Usage:
  bapm policy status [options]

Subcommands:
  status    Report effective policy discovery / enforcement (read-only)

Options (status):
  --json              Machine-readable JSON report
  --policy <path>     Use explicit policy file
  --no-policy         Escape hatch (report disabled)
  --check             Non-zero exit when no usable policy is found
  --help, -h          Show this help
`;
}

export function formatPolicyStatusHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} policy status — Report effective policy posture (read-only)

Usage:
  bapm policy status [options]

Options:
  --json              Emit stable JSON keys (outcome, source, provider, ...)
  --policy <path>     Use explicit policy file (wins over dual-read)
  --no-policy         Skip discovery; report disabled/escaped
  --check             Exit non-zero when outcome is not usable found
  --help, -h          Show this help

Default exit is 0 for found, absent, disabled, and soft diagnostic errors.
Does not mutate lockfiles, manifests, or modules.
`;
}

export async function runPolicyCli(
  deps: LifecycleCliDeps,
  options: PolicyCliOptions,
): Promise<LifecycleResult> {
  const parsed = parsePolicyArgs(options.args ?? []);

  if (parsed.help) {
    if (parsed.subcommand === "status") {
      console.log(formatPolicyStatusHelp(deps));
    } else {
      console.log(formatPolicyHelp(deps));
    }
    return { ok: true, exitCode: 0 };
  }

  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }

  try {
    const report = runPolicyStatus({
      cwd: options.cwd,
      policyPath: parsed.policyPath,
      policy: parsed.policyPath,
      noPolicy: parsed.noPolicy,
    });

    if (parsed.json) {
      console.log(JSON.stringify(report));
    } else {
      console.log(formatHumanReport(report));
    }

    const usable = report.outcome === "found";
    if (parsed.check && !usable) {
      return {
        ok: false,
        exitCode: 1,
        message: `No usable policy (outcome=${report.outcome})`,
      };
    }
    return { ok: true, exitCode: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}

function formatHumanReport(report: PolicyStatusReport): string {
  const counts = report.rule_counts;
  const chain = report.extends_chain.length === 0 ? "(none)" : report.extends_chain.join(" -> ");
  const lines = [
    `outcome: ${report.outcome}`,
    `source: ${report.source ?? "(none)"}`,
    `provider: ${report.provider}`,
    `enforcement: ${report.enforcement ?? "(none)"}`,
    `extends_chain: ${chain}`,
    `rule_counts: allow=${counts.allow} deny=${counts.deny} require=${counts.require} max_depth=${counts.max_depth} require_pinned_constraint=${counts.require_pinned_constraint}`,
  ];
  if (report.warnings.length > 0) {
    lines.push(`warnings: ${report.warnings.length}`);
  }
  if (report.diagnostics.length > 0) {
    for (const d of report.diagnostics) {
      const msg =
        d && typeof d === "object" && "message" in d
          ? String((d as { message: unknown }).message)
          : JSON.stringify(d);
      lines.push(`diagnostic: ${msg}`);
    }
  }
  return lines.join("\n");
}
