import {
  fetchMarketplace,
  getMarketplace,
  MarketplaceNotFoundError,
  type MarketplacePlugin,
} from "@bapm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type SearchCliDeps = LifecycleCliDeps;

export type SearchOptions = { args?: string[]; cwd?: string };

export function formatSearchHelp(deps: SearchCliDeps): string {
  return `${deps.name} search — Search a registered marketplace for plugins

Usage:
  bapm search QUERY@MARKETPLACE [options]

Arguments:
  QUERY@MARKETPLACE   Search term and marketplace alias, joined by @ (split on last @)

Options:
  --limit <n>         Maximum results to display (default: 20)
  -v, --verbose       Show richer match details
  --help, -h          Show this help

Notes:
  Empty matches exit 0 with a no-match hint.
  Unknown marketplace / bad expression / unknown flags exit non-zero.
  Install a hit with: bapm install NAME@MARKETPLACE
`;
}

export type ParsedSearchArgs = {
  help?: boolean;
  expression?: string;
  query?: string;
  marketplace?: string;
  limit: number;
  verbose: boolean;
  error?: string;
};

export function parseSearchArgs(argv: string[]): ParsedSearchArgs {
  let help = false;
  let expression: string | undefined;
  let limit = 20;
  let verbose = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--verbose" || arg === "-v") {
      verbose = true;
      continue;
    }
    if (arg === "--limit") {
      const raw = argv[++i];
      if (raw === undefined) {
        return { limit, verbose, error: "Missing value for --limit" };
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        return { limit, verbose, error: `Invalid --limit value: ${raw}` };
      }
      limit = n;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const raw = arg.slice("--limit=".length);
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        return { limit, verbose, error: `Invalid --limit value: ${raw}` };
      }
      limit = n;
      continue;
    }
    if (arg.startsWith("-") && arg !== "-") {
      return {
        limit,
        verbose,
        error: `Unknown flag: ${arg}`,
      };
    }
    if (expression === undefined) {
      expression = arg;
      continue;
    }
    return {
      limit,
      verbose,
      expression,
      error: `Unexpected argument: ${arg}`,
    };
  }

  if (help) {
    return { help: true, limit, verbose, expression };
  }

  if (!expression) {
    return {
      limit,
      verbose,
      error: "Usage: bapm search QUERY@MARKETPLACE (expression required)",
    };
  }

  const at = expression.lastIndexOf("@");
  if (at <= 0 || at === expression.length - 1) {
    return {
      limit,
      verbose,
      expression,
      error:
        "Invalid search expression: expected QUERY@MARKETPLACE (split on last @)",
    };
  }

  return {
    expression,
    query: expression.slice(0, at),
    marketplace: expression.slice(at + 1),
    limit,
    verbose,
  };
}

function printMatches(
  plugins: MarketplacePlugin[],
  marketplace: string,
  verbose: boolean,
): void {
  for (const p of plugins) {
    const desc = p.description?.trim() || "(no description)";
    // Print plugin name once per hit so --limit counting stays accurate.
    console.log(`${p.name}  ${desc}`);
    if (verbose) {
      if (p.version) console.log(`  version: ${p.version}`);
      if (p.tags.length > 0) console.log(`  tags: ${p.tags.join(", ")}`);
    }
  }
  console.log("");
  console.log(`Install a result with: bapm install NAME@${marketplace}`);
}

export async function runSearchCli(
  deps: SearchCliDeps,
  options: SearchOptions = {},
): Promise<LifecycleResult> {
  const parsed = parseSearchArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatSearchHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(parsed.error);
    return { ok: false, exitCode: 1, message: parsed.error };
  }

  const marketplaceName = parsed.marketplace!;
  const query = parsed.query ?? "";

  try {
    const source = getMarketplace(marketplaceName);
    if (!source) {
      throw new MarketplaceNotFoundError(marketplaceName);
    }
    const manifest = await fetchMarketplace(source);
    const matches = manifest.search(query);
    const limited = matches.slice(0, parsed.limit);

    if (limited.length === 0) {
      console.log(
        `No plugins matching '${query}' in marketplace '${marketplaceName}'.`,
      );
      console.log(
        `Try a broader query, or run 'bapm marketplace browse ${marketplaceName}'.`,
      );
      return { ok: true, exitCode: 0 };
    }

    printMatches(limited, marketplaceName, parsed.verbose);
    return { ok: true, exitCode: 0 };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error(message);
    return { ok: false, exitCode: 1, message };
  }
}
