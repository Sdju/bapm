## ADDED Requirements

### Requirement: PackOutputs git resolve uses ambient credential suppress

When PackOutputs remote resolve spawns git (`ls-remote`, fetch, or equivalent) for non-local package entries, the child environment MUST follow the git-ambient-suppress capability: suppress ambient unselected-class tokens, clear inherited Auth git config, attach only selected-class credentials when scheme policy allows, and refuse non-https git-HTTP attach except loopback / insecure exemption.

#### Scenario: PackOutputs ls-remote suppresses ambient GitHub token for ado remote

- **WHEN** PackOutputs resolves an ado-class remote while `GITHUB_TOKEN` is set in the parent environment
- **THEN** the git child MUST NOT inherit the GitHub token for credential use
