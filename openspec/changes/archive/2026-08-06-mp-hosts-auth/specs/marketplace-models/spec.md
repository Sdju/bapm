## MODIFIED Requirements

### Requirement: MarketplaceSource URL-first model

The system MUST represent a registered marketplace as an immutable source with at least `name`, `url`, `ref` (default `main`), and `path` (default `marketplace.json`, or empty for a direct remote manifest URL). Legacy mirror fields `owner`, `repo`, `host`, and `branch` MAY be synthesized from or into `url`/`ref` for APM-compatible serialization. Source kind MUST be derived as one of `local` | `url` | `github` | `gitlab` | `ado` | `git` using path/URL heuristics: local path or `file://` → `local`; direct HTTPS path ending in `/marketplace.json` with empty `path` → `url`; otherwise host classification MUST map github.com / `*.ghe.com` / `GITHUB_HOST` GHES → `github`; gitlab.com / `*.gitlab.com` / `GITLAB_HOST` / `APM_GITLAB_HOSTS` → `gitlab`; ADO hostnames → `ado`; other remotes → `git`. Host classification used for kind MUST align with the marketplace-hosts-auth capability (including fail-closed GHES↔GitLab overlap when those env signals conflict).

#### Scenario: OWNER/REPO synthesizes github URL

- **WHEN** a source is constructed with name and legacy owner/repo (or equivalent shorthand fields) without an explicit url
- **THEN** the model MUST expose a canonical HTTPS github URL (host default `github.com`) and derived kind `github`

#### Scenario: Direct marketplace.json URL is kind url

- **WHEN** a source has an HTTPS URL whose path ends with `/marketplace.json` and `path` is empty
- **THEN** derived kind MUST be `url` and remote-manifest detection MUST be true

#### Scenario: Local path or file URI is kind local

- **WHEN** a source url is an absolute/relative filesystem path, `~` path, or `file://` URI
- **THEN** derived kind MUST be `local`

#### Scenario: gitlab.com URL is kind gitlab

- **WHEN** a source url is an HTTPS git URL on `gitlab.com` with a non-empty marketplace path
- **THEN** derived kind MUST be `gitlab`

#### Scenario: GHE host remains github kind

- **WHEN** a source url host ends with `.ghe.com` (or matches `GITHUB_HOST`)
- **THEN** derived kind MUST be `github` (enterprise API base is a fetch concern, not a separate kind enum value)
