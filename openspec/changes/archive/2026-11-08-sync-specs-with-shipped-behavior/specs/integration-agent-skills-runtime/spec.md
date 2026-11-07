## MODIFIED Requirements

### Requirement: Activation is explicit only

agent-skills MUST activate only when the composition root / install selects it via forced `--target agent-skills`, or via manifest `active` selecting `agent-skills`, once `@b-apm/integration-agent-skills` is registered (by canonical package resolution or an object-map entry). Presence of `.agents/` alone MUST NOT activate the host.

#### Scenario: Forced target activates without detect

- **WHEN** agent-skills is registered and install runs with forced target `agent-skills`
- **THEN** install MUST invoke agent-skills materialize even though `detect` is false

#### Scenario: Manifest active activates without detect

- **WHEN** `@b-apm/integration-agent-skills` is installed in the project, the manifest declares `active: { target: agent-skills }` without a `targets:` entry, and install runs without `--target`
- **THEN** install MUST activate `agent-skills` and MUST invoke its materialize
