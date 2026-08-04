import {
  assertExperimentalRegistriesEnabled,
  buildPublishArchive,
  createRegistryClient,
  loadManifest,
  resolveRegistryBaseUrl,
  type RegistryEntry,
} from "@bapm/core";
import { createPublish } from "@/modules/Publish";
import { coreIntegration } from "../integrations/core.ts";

export const publish = createPublish({
  name: coreIntegration.name,
  buildPublishArchive: (options) => buildPublishArchive(options),
  createRegistryClient: (options) => createRegistryClient(options),
  assertExperimentalRegistriesEnabled: (options) => assertExperimentalRegistriesEnabled(options),
  loadManifest: (options) => loadManifest(options),
  resolveRegistryBaseUrl: (args) =>
    resolveRegistryBaseUrl({
      registries: args.registries as Record<string, RegistryEntry | string> | undefined,
      registryName: args.registryName,
      registryBaseUrl: args.registryBaseUrl,
    }),
});
