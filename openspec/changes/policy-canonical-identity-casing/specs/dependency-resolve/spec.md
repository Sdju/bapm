## MODIFIED Requirements

### Requirement: Minimum safe repo identity for cache and resolve

Git repo identity for resolve/cache/materialize MUST normalize host case and trailing `.git` so equivalent URLs share identity; cache keys MUST NOT isolate solely by ref (req-rs-016). Path comparison MUST be case-sensitive by default. The implementation MUST case-fold repository-coordinate path segments (ASCII `A–Z` → `a–z` only) for hosts disclosed as case-insensitive in the conformance statement — at minimum `github.com`, hosts ending in `.ghe.com`, and the literal `GITHUB_HOST` GHES host — and MUST case-fold repository-coordinate segments for every `source: registry` dependency (including registry prefixes) regardless of host. Local-path, marketplace, and every other host MUST remain path case-sensitive. The same source and host rules MUST govern policy operands under req-pl-018; repository identity and policy matching MUST NOT diverge.

#### Scenario: URL normalize same identity

- **WHEN** two URLs differ only by host case or a trailing `.git`
- **THEN** they MUST share the same minimum repo identity key

#### Scenario: GitHub path case folds into one identity

- **WHEN** two GitHub (or disclosed case-insensitive host) references differ only by owner/repository path case
- **THEN** they MUST share the same minimum repo identity key

#### Scenario: Unknown host path case remains distinct

- **WHEN** two references on a host not disclosed as case-insensitive differ only by repository path case
- **THEN** they MUST remain distinct identity keys

#### Scenario: Registry source folds path case

- **WHEN** two registry-sourced dependencies differ only by repository-coordinate path case
- **THEN** they MUST share the same identity key at every cache layer
