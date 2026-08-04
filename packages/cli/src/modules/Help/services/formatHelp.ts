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
  lock       Resolve dependencies and write the lockfile (no host deploy)
  install    Install agentic dependencies from ${deps.manifestFile}
  update     Re-resolve pins (rs-011/rs-012); --dry-run / -y
  outdated   Compare lock pins to remote tips (exit 0 when outdated)
  uninstall  Remove packages from manifest, modules, deploy, lock
  prune      Remove orphan modules not in the resolved graph
  deps       Inspect lock deps (list | tree | why)
  audit      Integrity checks (--ci gate)
  doctor     Environment and project sanity checks

Install flags (see also: bapm help install):
  --frozen       Fail closed on lock drift; re-verify deployed hashes when present
  --target <id>  Force a registered host target (e.g. cursor)
`;
}

export function formatInstallTopicHelp(deps: HelpContentDeps): string {
  return `${deps.name} install — Install agentic dependencies from ${deps.manifestFile}

Usage:
  bapm install [options]

Options:
  --frozen          Fail if lock is missing or pins drift; re-verify deployed_file_hashes when present
  --target <id>     Force activation of a registered host target (e.g. cursor)
  --update          Re-resolve mutable refs (rejected with --frozen)
  --help, -h        Show this help

Unknown flags are rejected. --frozen cannot be combined with --update.
`;
}
