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
  install    Install agentic dependencies from ${deps.manifestFile} (stub)
`;
}
