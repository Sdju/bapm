## ADDED Requirements

### Requirement: Authoring check git children use ambient credential suppress

When marketplace Authoring `check` (or equivalent validate path) spawns git against a remote, the child environment MUST follow the git-ambient-suppress capability: suppress ambient unselected-class tokens, clear inherited Auth git config, attach only selected-class credentials when scheme policy allows, and refuse non-https git-HTTP attach except loopback / insecure exemption. Thin env token helpers used for non-git HTTP checks MUST continue to avoid cross-class attach and MUST NOT regress secret redaction.

#### Scenario: Authoring check git suppresses ambient unselected tokens

- **WHEN** Authoring check runs git against a remote whose selected class is gitlab while `GITHUB_TOKEN` is present in the parent environment
- **THEN** the git child MUST NOT inherit the GitHub token for credential use
