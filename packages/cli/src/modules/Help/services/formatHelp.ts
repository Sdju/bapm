export interface HelpContentDeps {
  name: string;
  manifestFile: string;
}

export function formatHelp(deps: HelpContentDeps): string {
  return `${deps.name} — Better Agent Package Manager

Usage:
  bapm <command>

Commands:
  help         Show this help
  version      Print version
  init         Scaffold a new ${deps.manifestFile} (producer)
  plugin       Scaffold a thin plugin project (plugin init)
  lock         Resolve dependencies and write the lockfile (no host deploy)
  install      Install agentic dependencies from ${deps.manifestFile} (or a pack .zip)
  pack         Build a plain-zip producer archive (--archive / --check-release / --check-versions)
  publish      Publish flat registry zip via PUT (experimental; BAPM_EXPERIMENTAL_REGISTRIES=1)
  self-update  Check / apply CLI updates from npm (--check)
  update       Re-resolve dependency pins; --dry-run / -y
  outdated     Compare lock pins to remote tips (exit 0 when outdated)
  uninstall    Remove packages from manifest, modules, deploy, lock
  prune        Remove orphan modules not in the resolved graph
  deps         Inspect lock deps (list | tree | why) or wipe modules (clean)
  audit        Integrity checks (--ci gate)
  doctor       Environment and project sanity checks
  compile      Emit the agent's instructions file (AGENTS.md, CLAUDE.md, …)
  cache        Modules-cache info | clean (apm_modules)
  policy       Policy status (read-only governance posture)
  approve      Persist user-local allow (-y/--all, --pending; not project yml)
  deny         Persist user-local MCP deny (~/.bapm/config.json; not project yml)
  marketplace  Consumer registry + authoring (init/package/check)
  search       Search plugins in a registered marketplace (QUERY@MARKETPLACE)
  find         Trace a deployed path to locked package(s) (--source / --path)
  view         Inspect a locally installed package (offline; lock + modules)
  targets      Inspect registered host targets (--json / --all; read-only)
  mcp          Inspect MCP servers from manifest/lock (list | show | search)
  config       Inspect / update user defaults in ~/.bapm/config.json
  auth         Report credentials for a git host (--check / --export; read-only)
  run          Run a script from ${deps.manifestFile} scripts: (default: start)
  preview      Resolve and print a script command without executing it
  runtime      Inspect AI runtime CLIs (list | status; read-only; setup/remove deferred)

Install flags (see also: bapm help install):
  --frozen                 Fail closed on lock drift; re-verify deployed hashes when present
  --no-frozen              Opt out of frozen (including when CI defaults to frozen)
  --target <id>            Force a registered host target (overrides manifest active)
  --trust-transitive-mcp   Deploy dependency MCP (default: direct dependencies.mcp only)
  --trust-bin / --no-trust-bin   Per-invocation bin/ consent (default: skip without explicit grant)

Experimental registries:
  Set BAPM_EXPERIMENTAL_REGISTRIES=1 to enable registry resolve/install and publish.
`;
}

export function formatInstallTopicHelp(deps: HelpContentDeps): string {
  return `${deps.name} install — Install agentic dependencies from ${deps.manifestFile}

Usage:
  bapm install [options]
  bapm install <package-ref...>   Add package ref(s), then install
  bapm install <archive.zip>   Install from a pack-produced plain zip archive

Options:
  --frozen                 Fail if lock is missing or pins drift; re-verify deployed_file_hashes when present
  --no-frozen              Opt out of frozen mode (including CI-default frozen)
  --force                  Accepted for APM parity; currently has no effect (does not refresh refs or bypass frozen/policy)
  --allow-insecure         Dual-consent half for direct http:// dependencies
  --allow-insecure-host <hostname>
                           Allow transitive http:// from this FQDN (repeatable)
  --dev                    Write package-ref add under devDependencies.apm
  --only <apm|mcp>         Only APM packages or only MCP configure
  --target <id>            Force activation of a registered host target (overrides manifest active)
  --update                 Re-resolve mutable refs (rejected with frozen / CI-default frozen)
  --policy <path>          Use explicit policy file (wins over apm-policy.yml / bapm-policy.yml)
  --no-policy              Skip repository-local policy only; org/remote deny still applies
  --no-policy-all          Full escape: skip local and org policy (also: BAPM_POLICY_DISABLE=1)
  --trust-transitive-mcp   Deploy MCP from dependencies (default: direct dependencies.mcp only)
  --trust-bin              Consent to deploy dependency/plugin bin/ for this run (when policy allows)
  --no-trust-bin           Skip bin/ deploy for this run (even when policy would allow)
  --help, -h               Show this help

Host selection:
  Priority: --target <id> → local-overlay active → manifest active → config target → sole auto-detect → fail.
  Use active in bapm.yml / apm.yml when detect is missing or ambiguous.

MCP:
  Eligible MCP servers are written to the active agent's MCP config (for Cursor: .cursor/mcp.json).
  Direct dependencies.mcp are deployed by default. Transitive MCP requires --trust-transitive-mcp
  or an executables.allow grant for that package. Once any grant exists (bapm.yml executables,
  bapm approve / deny), every dependency with MCP must be approved or denied.

Bin consent:
  All installs (interactive and non-interactive) skip dependency bin/ unless --trust-bin or a
  persisted executables.allow bin grant applies. A TTY is not implicit consent; pass --trust-bin
  or approve bin persistently (bapm approve <pkg> --bin). Flags cannot override org/project deny.

Unknown flags are rejected. --frozen and --no-frozen cannot be combined.
--trust-bin and --no-trust-bin cannot be combined.
Frozen (explicit or when CI is truthy) cannot be combined with --update.
When the CI environment variable is truthy (not "", "0", or "false"), install
defaults to frozen unless --no-frozen is passed.
A local .zip path is installed as a pack archive: members are added to the current directory,
nothing else is removed, and existing files with different content are never overwritten.
`;
}
