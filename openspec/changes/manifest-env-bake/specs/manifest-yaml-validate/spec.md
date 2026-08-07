## ADDED Requirements

### Requirement: Manifest may declare top-level env for bake

The manifest YAML validator MUST accept an optional top-level `env` field as a string-to-string mapping with env-safe keys (`[A-Za-z_][A-Za-z0-9_]*`). Invalid shapes MUST fail validation. The field is a bapm extension used by MCP bake lookup; it MUST NOT be rejected solely as an unknown top-level key.

#### Scenario: env mapping round-trips on parse

- **WHEN** a valid manifest includes `env: { FOO: "bar" }`
- **THEN** the loaded document MUST expose `env.FOO` as `"bar"`
