# policy-extends-resolve Specification

## Purpose

Resolves OpenAPM `extends:` policy inheritance into one effective document: depth/cycle guards, leaf host-class pin, and §6.4 merge for families the install gate evaluates.

## Requirements

### Requirement: Extends chain depth and cycle rejection
A conforming load path MUST resolve `extends:` into an ordered chain and MUST reject chains deeper than **5** layers with a diagnostic. Cycles MUST be rejected with a diagnostic that names the cycle members (pl-003). Relative path refs and `owner/repo` (or URL) refs MUST be supported for chain walking.

#### Scenario: Valid short chain merges
- **WHEN** a leaf policy extends a parent within depth ≤5 without cycles
- **THEN** resolve MUST succeed and yield a single effective policy document

#### Scenario: Depth exceeding five rejected
- **WHEN** resolving an `extends:` chain would exceed 5 layers
- **THEN** resolve MUST fail with a diagnostic that the depth limit was exceeded

#### Scenario: Cycle rejected with members named
- **WHEN** an `extends:` ref would revisit a policy already on the chain (including self-extends)
- **THEN** resolve MUST fail and the diagnostic MUST name the cycle members

### Requirement: Host-class pin on extends
The implementation MUST pin every `extends:` reference to the **host class** of the leaf policy (pl-004). A policy fetched from one host class MUST NOT extend a policy from any other host class; cross-host-class `extends:` MUST be rejected before merge. Local filesystem leaf policies MUST use a defined host-class assignment (project remote’s class when available, otherwise an explicit local/file class) so pin checks remain deterministic.

#### Scenario: Same-host-class extends allowed
- **WHEN** leaf and ancestor policies share the same host class
- **THEN** resolve MUST proceed to merge

#### Scenario: Cross-host-class extends rejected
- **WHEN** an `extends:` target resolves to a different host class than the leaf
- **THEN** resolve MUST fail with a host-class pin diagnostic

### Requirement: Merge per OpenAPM section 6.4 for gate families
The implementation MUST merge parent→child along the chain per OpenAPM §6.4 (pl-006) for at least: `enforcement` (stricter wins: block > warn > off); `fetch_failure` (child overrides if set); `dependencies.allow` (intersection; null transparent); `dependencies.deny` / `dependencies.require` (union, dedup, parent order preserved); `dependencies.max_depth` (min); `dependencies.require_pinned_constraint` (logical OR / tighten-only once true if present). Families not evaluated by the gate (e.g. mcp.*, compilation.*) MAY be left unmerged or thin-documented as N/A for enforcement, but MUST NOT silently claim merged behavior without tests.

#### Scenario: Stricter enforcement wins
- **WHEN** parent has `enforcement: warn` and child has `enforcement: block`
- **THEN** the effective document MUST have `enforcement: block`

#### Scenario: Allow lists intersect
- **WHEN** parent allows `org/*` and child allows `org/a` only
- **THEN** the effective allow list MUST be the intersection consistent with §6.4 / tri-state rules

#### Scenario: Max depth takes minimum
- **WHEN** parent sets `max_depth: 10` and child sets `max_depth: 5`
- **THEN** the effective `max_depth` MUST be `5`

### Requirement: Gate consumes merged effective policy
Install/lock/update policy evaluation MUST use the merged effective document after discovery and extends resolve—not the unresolved leaf alone—when an `extends:` chain is present.

#### Scenario: Parent deny blocks after merge
- **WHEN** a parent policy denies a package and the leaf extends it with `enforcement: block`
- **THEN** the install gate MUST report the deny against the merged effective policy
