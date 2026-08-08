## ADDED Requirements

### Requirement: Declared plugin commands and hooks are supported

When a portable Agent Plugins `plugin.json` declares `commands` and/or `hooks` path entries, bapm MUST treat those declarations as requirements, not hints. Declared paths MUST be resolved relative to the plugin root, discovered as `command` / `hook` primitives (or equivalent attributed units that materialize as those types), and deployed through the active host matrix. Missing declared paths or paths that escape the plugin root MUST fail closed with a non-zero outcome before deployment or lockfile commit for that install. Omitting the field or using an empty list MUST mean the plugin has no component of that type.

#### Scenario: Declared command path materializes on Cursor

- **WHEN** an installed portable plugin declares a `commands` path that exists inside the plugin root and Cursor is active
- **THEN** the corresponding command MUST be materialized under `.cursor/commands/` and MUST NOT be treated as an unsupported component

#### Scenario: Declared hook path materializes on Cursor

- **WHEN** an installed portable plugin declares a `hooks` path that exists inside the plugin root and Cursor is active
- **THEN** the corresponding hook MUST be merged under `.cursor/hooks.json` (with registered-root script handling) and MUST NOT be treated as an unsupported component

#### Scenario: Missing or escaping declared path fails closed

- **WHEN** `plugin.json` declares a `commands` or `hooks` path that is missing or escapes the plugin root
- **THEN** install MUST fail closed before deploy/lock commit with a diagnostic naming the bad path

### Requirement: Compatibility matrix lists commands and hooks support

The Agent Plugins compatibility status artifact MUST list `commands` and `hooks` as supported (or target-specific where host matrix differs) for the declared-`plugin.json`-path surface, and MUST NOT continue to classify them under a blanket `unsupported-components` / `not-supported` bucket. Remaining non-goals (sandboxing, OAuth/secrets, undeclared agents, client extensions, vendor-specific extensions) MUST stay outside the supported claim. Generated matrix check MUST fail on drift.

#### Scenario: Matrix no longer marks commands hooks not-supported

- **WHEN** maintainers inspect the Agent Plugins compatibility cases after this change
- **THEN** `commands` and `hooks` MUST appear with a supported or target-specific status derived from fixtures/tests, not as blanket not-supported

## MODIFIED Requirements

### Requirement: Non-goals are not implicit support claims

Sandboxing, OAuth or secret injection, undeclared agents, client extensions, vendor-specific extension behavior, and other unsupported components MUST remain outside this boundary (no silent support claim via install/materialize). Declared `commands` and `hooks` paths in `plugin.json` are in-boundary per the declared commands/hooks requirement and MUST NOT be described as unsupported solely for being hooks/commands. Reserved or secret-like MCP environment entries and escaping skill paths MUST be rejected or withheld.

#### Scenario: Unsafe portable input is not deployed

- **WHEN** a portable MCP entry attempts to override plugin-owned environment or a skill path escapes the plugin root
- **THEN** the entry is not deployed and diagnostics explain the rejection

#### Scenario: Undeclared agents remain non-support

- **WHEN** a portable plugin contains an `agents/` directory that is not part of the supported declared commands/hooks/skills/MCP surface claimed by the matrix
- **THEN** bapm MUST NOT silently claim agents support via the commands/hooks change
