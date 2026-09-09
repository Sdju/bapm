## MODIFIED Requirements

### Requirement: Soft surface for non-MCP executables

Hooks and canvas executable primitives MUST remain ungated by the MCP trust ladder and by this change's bin consent flags. Documentation and Limitations MUST state honestly that gate+audit twin coverage for the sc-009 MCP claim remains MCP-focused, that **bin** is gated via the shared ExecutableTrust resolver (type `bin`) plus install `--trust-bin` / `--no-trust-bin` consent, and that hooks/canvas remain soft (ungated) relative to that surface.

#### Scenario: Soft honesty documented

- **WHEN** a reader reviews Limitations or trust docs after this change
- **THEN** the text MUST state that hooks and canvas are not gated like MCP under the claimed executable governance surface, and MUST NOT claim that bin remains ungated soft debt alongside them

#### Scenario: Bin gating is documented as consent plus shared resolver

- **WHEN** a reader reviews Limitations or install/trust docs after this change
- **THEN** the text MUST mention bin consent flags and/or ExecutableTrust for bin (not a second policy noun)
