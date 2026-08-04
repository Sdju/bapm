export interface HelpContentDeps {
  name: string;
  manifestFile: string;
}

export function formatHelp(deps: HelpContentDeps): string {
  return `${deps.name} — Better Agent Package Manager

Usage:
  bapm <command>

Commands:
  help       Show this help
  version    Print version
  init       Scaffold a new ${deps.manifestFile} (producer)
  lock       Resolve dependencies and write the lockfile (no host deploy)
  install    Install agentic dependencies from ${deps.manifestFile} (or a pack .zip)
  pack       Build a plain-zip producer archive (--archive / --check-release)
  update     Re-resolve pins (rs-011/rs-012); --dry-run / -y
  outdated   Compare lock pins to remote tips (exit 0 when outdated)
  uninstall  Remove packages from manifest, modules, deploy, lock
  prune      Remove orphan modules not in the resolved graph
  deps       Inspect lock deps (list | tree | why)
  audit      Integrity checks (--ci gate)
  doctor     Environment and project sanity checks
  compile    Emit AGENTS.md from discovered primitives (cursor)
  cache      Modules-cache info | clean (apm_modules)

Install flags (see also: bapm help install):
  --frozen                 Fail closed on lock drift; re-verify deployed hashes when present
  --target <id>            Force a registered host target (e.g. cursor)
  --trust-transitive-mcp   Deploy dependency MCP (default: direct dependencies.mcp only)
`;
}

export function formatInstallTopicHelp(deps: HelpContentDeps): string {
  return `${deps.name} install — Install agentic dependencies from ${deps.manifestFile}

Usage:
  bapm install [options]
  bapm install <archive.zip>   Install from a pack-produced plain zip archive

Options:
  --frozen                 Fail if lock is missing or pins drift; re-verify deployed_file_hashes when present
  --target <id>            Force activation of a registered host target (e.g. cursor)
  --update                 Re-resolve mutable refs (rejected with --frozen)
  --policy <path>          Use explicit policy file (wins over apm-policy.yml / bapm-policy.yml)
  --no-policy              Skip policy discovery and checks (also: BAPM_POLICY_DISABLE=1)
  --trust-transitive-mcp   Deploy MCP from dependencies (default: direct dependencies.mcp only)
  --help, -h               Show this help

MCP / Cursor:
  When the cursor target is active, eligible MCP servers are written to .cursor/mcp.json.
  Direct dependencies.mcp are deployed by default. Transitive MCP requires --trust-transitive-mcp
  (or an executables.allow / allowExecutables grant for that package — sc-009).
  Auto-detect without .cursor/ does not mkdir solely for MCP.

Unknown flags are rejected. --frozen cannot be combined with --update.
A local .zip path is detected as a pack archive (install-from-archive round-trip).
`;
}
