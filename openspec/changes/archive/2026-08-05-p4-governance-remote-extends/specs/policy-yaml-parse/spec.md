## ADDED Requirements

### Requirement: Extends field accepted for chain resolve

The parser MUST accept a string `extends` field (relative path, `owner/repo`, or URL form documented by resolve) without treating it as an unknown-key warning, and MUST expose it on the model for chain resolution.

#### Scenario: Extends string preserved

- **WHEN** policy YAML sets `extends: contoso-enterprise/policy`
- **THEN** parse MUST succeed and the model MUST retain that `extends` value

### Requirement: Discovery block accepted when present

The parser MUST accept an optional top-level `discovery:` mapping used to select/order providers. Unknown nested keys under `discovery` MAY warn; the block MUST NOT crash parse.

#### Scenario: Discovery providers list parses

- **WHEN** policy includes `discovery: { providers: [local] }`
- **THEN** parse MUST succeed and provider selection data MUST be available to discovery
