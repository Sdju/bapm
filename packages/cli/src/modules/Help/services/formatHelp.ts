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
`;
}
