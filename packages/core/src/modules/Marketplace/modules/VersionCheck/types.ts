import type {
  MarketplaceAuthoringConfig,
  MarketplaceVersioningStrategy,
} from "../Authoring/types.ts";

export type PackageVersionRow = {
  path: string;
  version: string | null;
  ok: boolean;
  reason: string;
  error?: string;
  rendered_tag?: string | null;
};

export type VersionAlignmentReport = {
  strategy: MarketplaceVersioningStrategy;
  expected: string | null;
  ok: boolean;
  packages: PackageVersionRow[];
};

export type CheckVersionAlignmentOptions = {
  config: MarketplaceAuthoringConfig;
  cwd?: string;
  projectRoot?: string;
  root?: string;
};

export type LocalVersionStatus =
  | "ok"
  | "no_apm_yml"
  | "invalid_yaml"
  | "invalid_yaml_manifest"
  | "missing_version"
  | "invalid_plugin_json"
  | "missing_plugin_version"
  | "invalid_plugin_version";

export type LocalVersionRead = {
  version: string | null;
  status: LocalVersionStatus;
};
