import type { PolicyCliPorts } from "@/common/policyFetcher.ts";

export interface InstallDeps {
  name: string;
  manifestFile: string;
  lockFile: string;
}

export interface InstallOptions {
  args: string[];
  cwd?: string;
  /** Optional env for CI-default frozen resolution (defaults to `process.env`). */
  env?: Record<string, string | undefined>;
  /** Injected policy ports (tests); production defaults to a curl fetcher. */
  policyPorts?: PolicyCliPorts;
  /** Override `~/.bapm` user store (global installs pass the global root). */
  configDir?: string;
  marketplaceConfigDir?: string;
}

export interface InstallResult {
  ok: boolean;
  message?: string;
}
