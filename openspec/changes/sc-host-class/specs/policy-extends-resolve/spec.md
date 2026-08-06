## MODIFIED Requirements

### Requirement: Host-class pin on extends
The implementation MUST pin every `extends:` reference to the **host class** of the leaf policy (pl-004). Host class for this pin MUST be the same Public Suffix List eTLD+1 credential host-class helper used for OpenAPM §10.3 credential reuse (shared Auth / credential-host-class capability), not a last-two-labels approximation alone. A policy fetched from one host class MUST NOT extend a policy from any other host class; cross-host-class `extends:` MUST be rejected before merge. Local filesystem leaf policies MUST use a defined host-class assignment (project remote’s class when available, otherwise an explicit local/file class) so pin checks remain deterministic. This unify MUST NOT by itself be treated as sufficient evidence to claim sc-005 without the credential Auth Mode B suite.

#### Scenario: Same-host-class extends allowed
- **WHEN** leaf and ancestor policies share the same PSL eTLD+1 host class
- **THEN** resolve MUST proceed to merge

#### Scenario: Cross-host-class extends rejected
- **WHEN** an `extends:` target resolves to a different PSL eTLD+1 host class than the leaf
- **THEN** resolve MUST fail with a host-class pin diagnostic

#### Scenario: Multi-part public suffix not last-two-labels
- **WHEN** leaf and ancestor hosts differ only in a way that last-two-labels would falsely equate but Public Suffix List eTLD+1 differs (or the reverse for a known multi-part suffix fixture)
- **THEN** the pin decision MUST follow the PSL eTLD+1 helper
