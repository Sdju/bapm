## ADDED Requirements

### Requirement: Top-level approve and deny commands
The CLI MUST register top-level `approve` and `deny` commands that invoke interactive user-local grant persistence. Interactive defaults MUST target the user store only and MUST NOT persist interactive decisions into project `bapm.yml`. Top-level help MUST mention both commands. Unknown flags MUST fail closed with non-zero exit for parse errors.

#### Scenario: Approve command registered
- **WHEN** the user invokes `bapm approve` with a valid package identity under an injectable config root
- **THEN** the command MUST exit successfully after writing the grant to the user-local store without modifying project `bapm.yml`

#### Scenario: Deny command registered
- **WHEN** the user invokes `bapm deny` with a valid package identity under an injectable config root
- **THEN** the command MUST exit successfully after writing the deny to the user-local store without modifying project `bapm.yml`

#### Scenario: Top-level help mentions approve and deny
- **WHEN** top-level help is shown
- **THEN** the help text MUST mention `approve` and `deny`
