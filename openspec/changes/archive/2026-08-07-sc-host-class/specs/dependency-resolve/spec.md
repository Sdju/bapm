## ADDED Requirements

### Requirement: Resolve git children use ambient credential suppress

When `resolveAndLock` (or equivalent resolve/download path) spawns git for ref listing, clone, fetch, or validate of a remote, the child process environment MUST be constructed per the git-ambient-suppress capability: suppress ambient platform token env for unselected classes, clear inherited Auth git config material, attach only the selected credential host-class material (if any), and refuse non-https git-HTTP credential attach except loopback / insecure exemption. Resolve MUST NOT spawn fetch/validate git children that inherit ambient `GITHUB_TOKEN` / `GH_TOKEN` / class PATs when another class is selected.

#### Scenario: Resolver git spawn suppresses unselected tokens

- **WHEN** resolve downloads or lists refs for a remote whose selected class is not github while `GITHUB_TOKEN` is present in the parent environment
- **THEN** the git child MUST NOT inherit that GitHub token for credential use

#### Scenario: Resolver https git may attach selected class

- **WHEN** resolve fetches an `https://` git remote and a selected-class credential exists
- **THEN** the child MAY receive that selected-class credential after ambient suppress
