import { formatHelp, type HelpContentDeps } from "./services/formatHelp.ts";

export type { HelpContentDeps };

export interface HelpDeps extends HelpContentDeps {}

export function createHelp(deps: HelpDeps) {
  return {
    format(): string {
      return formatHelp(deps);
    },
    print(): void {
      console.log(formatHelp(deps));
    },
  };
}

export type HelpApi = ReturnType<typeof createHelp>;
