import { formatHelp, formatInstallTopicHelp, type HelpContentDeps } from "./services/formatHelp.ts";
import { formatPublishHelp } from "@/modules/Publish";
import { formatSelfUpdateHelp } from "@/modules/SelfUpdate";
import { formatLockHelp } from "@/modules/Lock";

export type { HelpContentDeps };

export interface HelpDeps extends HelpContentDeps {}

export function createHelp(deps: HelpDeps) {
  return {
    format(topic?: string): string {
      if (topic === "install") return formatInstallTopicHelp(deps);
      if (topic === "lock") return formatLockHelp();
      if (topic === "publish") {
        return formatPublishHelp({
          name: deps.name,
          buildPublishArchive: () => {
            throw new Error("help-only");
          },
          createRegistryClient: () => {
            throw new Error("help-only");
          },
          assertExperimentalRegistriesEnabled: () => {},
          loadManifest: () => {
            throw new Error("help-only");
          },
          resolveRegistryBaseUrl: () => ({ baseUrl: "" }),
        });
      }
      if (topic === "self-update") {
        return formatSelfUpdateHelp({
          name: deps.name,
          getVersion: () => "0.0.0",
          checkSelfUpdate: async () => ({
            currentVersion: "0.0.0",
            updateAvailable: false,
            unknownVersion: true,
            message: "",
          }),
        });
      }
      return formatHelp(deps);
    },
    print(topic?: string): void {
      console.log(this.format(topic));
    },
  };
}

export type HelpApi = ReturnType<typeof createHelp>;
