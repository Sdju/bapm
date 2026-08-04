import { formatHelp, formatInstallTopicHelp, type HelpContentDeps } from "./services/formatHelp.ts";

export type { HelpContentDeps };

export interface HelpDeps extends HelpContentDeps {}

export function createHelp(deps: HelpDeps) {
  return {
    format(topic?: string): string {
      if (topic === "install") return formatInstallTopicHelp(deps);
      return formatHelp(deps);
    },
    print(topic?: string): void {
      console.log(topic === "install" ? formatInstallTopicHelp(deps) : formatHelp(deps));
    },
  };
}

export type HelpApi = ReturnType<typeof createHelp>;
