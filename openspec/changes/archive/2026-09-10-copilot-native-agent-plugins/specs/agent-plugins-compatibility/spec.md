## ADDED Requirements

### Requirement: Compatibility matrix covers Copilot native registration

The Agent Plugins compatibility status artifact MUST include a fixture-backed case for Copilot-native registration of portable Agent Plugins 1.0 (catalog/ledger/settings projection; no copy / no `--plugin-dir` claim). The case MUST remain inside the portable compatibility boundary and MUST NOT encode an OpenAPM, marketplace publication, or universal-client certification claim. Generated matrix check MUST fail on drift.

#### Scenario: Matrix lists Copilot native registration support

- **WHEN** maintainers inspect the Agent Plugins compatibility cases after this change
- **THEN** a Copilot-native registration case MUST appear with supported (or equivalent) status derived from fixtures/tests, not as blanket not-supported
