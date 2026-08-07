## MODIFIED Requirements

### Requirement: Compile selects an explicit or unambiguous registered target
Compile MUST obtain target detection and compile emission from the registered integration registry. Without an explicit target, exactly one registered compile-capable integration MUST positively detect the project for compile to proceed. When zero or multiple registered integrations are detected, compile MUST fail with clear guidance to pass `--target <id>` and MUST not write a compile output. An explicit registered target MUST be accepted only when it exposes the compile capability.

#### Scenario: Compile automatically selects sole detected target
- **WHEN** `bapm compile` runs without `--target` and exactly one registered compile-capable integration detects the project
- **THEN** compile MUST use that integration's emission capability and succeed according to normal write, validate, or dry-run semantics

#### Scenario: Compile rejects absent or ambiguous automatic selection
- **WHEN** `bapm compile` runs without `--target` and zero or multiple registered compile-capable integrations detect the project
- **THEN** it MUST fail with guidance to pass `--target <id>` and MUST not create or modify compile output
