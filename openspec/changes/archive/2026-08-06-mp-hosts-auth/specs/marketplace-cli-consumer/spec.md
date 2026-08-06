## MODIFIED Requirements

### Requirement: marketplace add SOURCE
`bapm marketplace add SOURCE` MUST accept SOURCE forms: `OWNER/REPO` shorthand (default host github.com), HTTPS github / GitHub-enterprise / gitlab / ado repository URLs for unlocked kinds, HTTPS URL ending in `/marketplace.json`, and local path or `file://` URI. Flags `--name`, `--ref`, and `--host` (host for shorthand) MUST be accepted; `--host` MUST accept unlocked hosts including `github.com`, `*.ghe.com`, `GITHUB_HOST` GHES hostnames, gitlab.com / GitLab allowlist hosts, and ADO hostnames. Alias/`--name` MUST match `[a-zA-Z0-9._-]+`. Before persisting, add MUST probe-fetch the marketplace (force refresh) and MUST refuse generic `git` kind and GHES↔GitLab overlap with a clear error. On success it MUST write the source into `~/.bapm/marketplaces.json` (replace same name case-insensitively). Combining URL `#ref` with `--ref` MUST fail closed. Help and error text MUST NOT claim that only github.com remotes are supported.

#### Scenario: Add local marketplace.json succeeds
- **WHEN** `runCli(["marketplace", "add", "<path-to-dir-or-file>", "--name", "local-mp"])` runs against a valid local fixture
- **THEN** exit code MUST be `0` and `list` MUST subsequently show `local-mp`

#### Scenario: Invalid alias rejected
- **WHEN** add is invoked with `--name` containing characters outside `[a-zA-Z0-9._-]+`
- **THEN** exit code MUST be non-zero and the registry MUST be unchanged

#### Scenario: Generic git host refused at add
- **WHEN** add is given an HTTPS git URL whose host classifies as generic `git` (not github/gitlab/ado/enterprise allowlists)
- **THEN** exit code MUST be non-zero with a clear unsupported-host/kind message and no registry write

#### Scenario: Gitlab marketplace add accepted for probe
- **WHEN** add is given a gitlab.com HTTPS repository URL (or shorthand with gitlab `--host`) and the probe transport can return a valid marketplace.json
- **THEN** exit code MUST be `0` on successful probe and the registry MUST contain the new entry

#### Scenario: Enterprise --host accepted
- **WHEN** add is invoked with `OWNER/REPO` and `--host` set to a `*.ghe.com` host or configured `GITHUB_HOST`
- **THEN** the CLI MUST NOT reject solely because the host is not github.com (probe/fetch rules still apply)
