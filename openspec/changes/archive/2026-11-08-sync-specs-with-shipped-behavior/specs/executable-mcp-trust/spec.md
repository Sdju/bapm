## REMOVED Requirements

### Requirement: Soft surface for non-MCP executables

**Reason**: Constrained documentation wording ("a reader reviews Limitations…") rather than behaviour.

**Migration**: Replaced by "Hooks and canvas stay ungated while bin is gated", which states the install behaviour and pins the honesty rule to the generated conformance statement.

## ADDED Requirements

### Requirement: Hooks and canvas stay ungated while bin is gated

Hooks and canvas executable primitives MUST remain ungated by the MCP trust ladder and by bin consent flags. Dependency `bin/` MUST be gated via the shared executable trust resolver (type `bin`) plus install `--trust-bin` / `--no-trust-bin` consent. The conformance statement MUST list hooks/canvas as ungated in its limitations and MUST NOT list `bin` as ungated.

#### Scenario: Hooks deploy without an executable grant

- **WHEN** a dependency ships a hook and the consuming project has an `executables.allow` surface that does not mention that dependency
- **THEN** install MUST still deploy the hook for hosts that support hooks

#### Scenario: Bin is gated by the shared resolver

- **WHEN** a dependency ships `bin/` and non-interactive install runs without `--trust-bin` and without a `bin` grant
- **THEN** install MUST NOT deploy that `bin/`
