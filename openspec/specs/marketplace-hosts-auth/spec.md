# marketplace-hosts-auth Specification

## Purpose

Defines marketplace host classification and thin environment-scoped token resolution by host class so fetch and CLI attach only matching credentials and fail closed on cross-class reuse or GHES↔GitLab overlap — without claiming full OpenAPM §10.3 AuthResolver parity.

## Requirements

### Requirement: Marketplace host classification with env allowlists
The system MUST classify marketplace remotes into host classes used for fetch and auth: `github` (github.com), `ghe_cloud` (`*.ghe.com`), `ghes` (hostname equal to `GITHUB_HOST` when set), `gitlab` (gitlab.com, `*.gitlab.com`, or hosts listed in `GITLAB_HOST` / `APM_GITLAB_HOSTS`), and `ado` (`dev.azure.com`, `*.visualstudio.com`, and equivalent ADO hostnames already recognized by models). Classification MUST be deterministic. When the same hostname would match both a GitHub-class enterprise signal (`GITHUB_HOST` / GHES) and a GitLab allowlist signal, classification MUST fail closed with a clear overlap error before any token is resolved or network fetch begins. Generic unclassified remotes remain kind `git` for refuse-at-fetch (unless a later change unlocks them).

#### Scenario: github.com classifies as github
- **WHEN** a marketplace source URL host is `github.com`
- **THEN** host class MUST be github-class and derived source kind MUST be `github`

#### Scenario: GITHUB_HOST marks GHES
- **WHEN** `GITHUB_HOST` is set to `ghe.example.com` and the source host is `ghe.example.com`
- **THEN** classification MUST treat the host as GitHub-class enterprise (ghes) for Contents API base selection

#### Scenario: GHES and GitLab overlap fails closed
- **WHEN** the same hostname is both `GITHUB_HOST` and listed in `GITLAB_HOST` or `APM_GITLAB_HOSTS`
- **THEN** classification or registration MUST fail closed with an actionable overlap error and MUST NOT attach any token

#### Scenario: gitlab.com classifies as gitlab
- **WHEN** a marketplace source URL host is `gitlab.com`
- **THEN** derived source kind MUST be `gitlab`

#### Scenario: ado host classifies as ado
- **WHEN** a marketplace source URL host is `dev.azure.com` or a `*.visualstudio.com` host
- **THEN** derived source kind MUST be `ado`

### Requirement: Thin env token resolve by host class
The system MUST provide a thin token resolver that, given a classified marketplace host, returns at most one env-sourced credential for that class (or none). GitHub-class hosts MUST consult only GitHub-class env names (at least `GITHUB_TOKEN` and `GH_TOKEN`; org-scoped `GITHUB_APM_PAT_*` MAY be included when cheap). GitLab hosts MUST consult only GitLab env names (at least `GITLAB_TOKEN` and `GITLAB_APM_PAT` when present). ADO hosts MUST consult `ADO_APM_PAT` (az AAD bearer and credential helpers MUST NOT be required for this floor). The resolver MUST NEVER return a GitHub-class token for a GitLab or ADO host, and MUST NEVER return a GitLab or ADO token for a GitHub-class host. Diagnostics MAY name the env source id (for example `GITHUB_TOKEN`) and MUST NOT log or print the secret value. Absence of a token MUST be allowed (public/unauthenticated fetch or fail-soft authoring paths as specified elsewhere).

#### Scenario: GitHub token unused for gitlab
- **WHEN** only `GITHUB_TOKEN` (or `GH_TOKEN`) is set in the environment and the target host class is gitlab
- **THEN** resolve MUST return no token for that host and MUST NOT select the GitHub env value

#### Scenario: ADO uses ADO_APM_PAT only
- **WHEN** `ADO_APM_PAT` is set and GitHub/GitLab tokens are also set, and the target host class is ado
- **THEN** resolve MUST return the ADO PAT (or equivalent ado-class credential) and MUST NOT return GitHub or GitLab tokens

#### Scenario: GitLab env for gitlab host
- **WHEN** `GITLAB_TOKEN` or `GITLAB_APM_PAT` is set and the target host is gitlab.com (or an allowlisted GitLab host)
- **THEN** resolve MUST return that GitLab-class token for header attachment on GitLab REST fetch

#### Scenario: Secret value not logged
- **WHEN** a token is resolved for any class
- **THEN** error and diagnostic messages MUST NOT include the raw token string
