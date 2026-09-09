## ADDED Requirements

### Requirement: Object dependency skills and targets lists are validated

When an object-form APM dependency includes `skills` or `targets`, parse MUST treat them as optional meta (not source kinds) and MUST validate their shape: each MUST be a non-empty array of non-empty strings when present. `skills` names MUST NOT contain `..` path traversal or absolute/drive prefixes; duplicates MUST be retained as a unique set. Each `targets` token MUST pass existing mf-005 `isValidTargetToken` rules. Invalid shapes, empty arrays, traversal names, and unknown target tokens MUST fail closed with a diagnostic naming the dependency path. Valid lists MUST be retained on the parsed `ObjectDependency` (typed string arrays, not opaque `unknown`). Absence of either field MUST remain valid.

#### Scenario: Registry id skills and targets retained

- **WHEN** an object dependency provides `id` plus `skills: [deploy, lint]` and `targets: [cursor]`
- **THEN** parse MUST accept the entry and retain those string lists on the document

#### Scenario: Empty skills array rejected

- **WHEN** an object dependency provides a valid source and `skills: []`
- **THEN** parse MUST reject the manifest

#### Scenario: Traversal skill name rejected

- **WHEN** an object dependency provides a valid source and `skills: ["../evil"]`
- **THEN** parse MUST reject the manifest

#### Scenario: Unknown subset target token rejected

- **WHEN** an object dependency provides a valid source and `targets: [not-a-host]`
- **THEN** parse MUST reject the manifest naming the token

#### Scenario: Git object-form subset accepted

- **WHEN** an object dependency provides `git` plus valid `skills` and `targets` lists
- **THEN** parse MUST accept and retain those lists (same grammar as `id:`)
