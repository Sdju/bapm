## ADDED Requirements

### Requirement: Classify marketplace string and object forms
Classification MUST recognize marketplace dependencies from (1) string form `NAME@MARKETPLACE[#ref]` when the marketplace ref parser matches, and (2) object form containing a string `marketplace` key with plugin `name` and optional `version`/`ref` selector. Matched marketplace deps MUST classify as `kind: "marketplace"` (OpenAPM non-normative). Strings that look like git `owner/repo` or paths MUST NOT be forced into marketplace kind solely because they contain `@` outside the marketplace ref grammar.

#### Scenario: String NAME@MARKETPLACE classifies as marketplace
- **WHEN** a dependency string `tools@acme` is classified
- **THEN** the classified kind MUST be `marketplace`

#### Scenario: Object marketplace form classifies as marketplace
- **WHEN** a dependency object `{ "name": "tools", "marketplace": "acme", "version": "v1" }` is classified
- **THEN** the classified kind MUST be `marketplace`

#### Scenario: Git owner/repo is not marketplace
- **WHEN** a dependency string `acme/tools#main` is classified
- **THEN** the classified kind MUST NOT be `marketplace`

## MODIFIED Requirements

### Requirement: Classify dependency kinds per OpenAPM order
The system MUST classify each dependency declaration into one of: `local`, `registry`, `git-semver`, `git-literal` (and MAY recognize marketplace as non-normative). Classification MUST follow OpenAPM kind precedence: local → registry → git-semver → git-literal (req-rs-008), except that an explicit marketplace string/object form MUST classify as `marketplace` before being mistaken for registry or git. Git refs MUST be classified as semver range, literal, or none (req-rs-003).

#### Scenario: Local path kind
- **WHEN** a dependency uses `path:` / local-path form and has no `git:` / registry `id:`
- **THEN** the classified kind MUST be `local`

#### Scenario: Git-literal kind
- **WHEN** a dependency is `repo#main` or an object with a literal `ref:` (branch, tag name without semver range, or commit)
- **THEN** the classified kind MUST be `git-literal`

#### Scenario: Git-semver kind
- **WHEN** a dependency provides `ref:` as a node-semver range (for example `^1.2.0`)
- **THEN** the classified kind MUST be `git-semver`

#### Scenario: Registry kind uses registry fetch path
- **WHEN** a dependency provides registry `id:` (and registry coordinates)
- **THEN** the classified kind MUST be `registry`, and resolve/download MUST use the registry HTTP client path (see `registry-resolve-install`) and MUST NOT silently fall back to git

#### Scenario: Marketplace kind is resolved not fail-closed
- **WHEN** a dependency classifies as `marketplace`
- **THEN** graph resolve MUST invoke marketplace plugin resolve and continue with the resulting concrete dependency kind rather than failing closed solely for marketplace kind

### Requirement: Resolve marketplace dependencies into concrete kinds
When graph resolve encounters `kind: "marketplace"`, it MUST call marketplace plugin resolve (using `~/.bapm` registry + fetch/cache), replace the edge with the concrete git/local (or deferred-unsupported) result, continue BFS as for that concrete kind, and thread provenance into the lock write path for the resulting entry. Marketplace miss/fetch/unsupported-source MUST fail with clear diagnostics. Resolve MUST NOT silently treat a marketplace miss as bare git `owner/repo` without marketplace lookup.

#### Scenario: Marketplace dep continues as git after resolve
- **WHEN** the root declares `tools@acme` and marketplace resolve maps it to git coordinates
- **THEN** resolve MUST proceed along the git path and produce a lock entry carrying marketplace provenance fields

#### Scenario: Marketplace miss does not bare-git fallback
- **WHEN** marketplace resolve reports marketplace-not-found or plugin-not-found
- **THEN** graph resolve MUST fail with that class of error and MUST NOT install `NAME/MARKETPLACE` as a github repo shorthand
