## MODIFIED Requirements

### Requirement: Compile selects an explicit or unambiguous registered target

Compile MUST obtain target detection and compile emission from the registered integration registry. Selection MUST prefer an explicit forced `--target` / forced id when present. Else when the project manifest `active` lists exactly one registered compile-capable integration id, compile MUST select that id without requiring detect. Else without an explicit target, exactly one registered compile-capable integration MUST positively detect the project for compile to proceed. When `active` lists more than one id without an explicit `--target`, or when zero or multiple registered integrations are detected and no sole `active` id applies, compile MUST fail with clear guidance to pass `--target <id>` and MUST not write a compile output. An explicit registered target MUST be accepted only when it exposes the compile capability.

#### Scenario: Compile automatically selects sole detected target

- **WHEN** `bapm compile` runs without `--target`, without a sole manifest `active` compile id, and exactly one registered compile-capable integration detects the project
- **THEN** compile MUST use that integration's emission capability and succeed according to normal write, validate, or dry-run semantics

#### Scenario: Compile rejects absent or ambiguous automatic selection

- **WHEN** `bapm compile` runs without `--target`, without a sole manifest `active` compile id, and zero or multiple registered compile-capable integrations detect the project
- **THEN** it MUST fail with guidance to pass `--target <id>` and MUST not create or modify compile output

#### Scenario: Sole active selects compile without detect

- **WHEN** `bapm compile` runs without `--target`, `active` contains exactly one registered compile-capable id, and detect is absent
- **THEN** compile MUST use that id’s emission capability

#### Scenario: Multi active without force fails compile

- **WHEN** `bapm compile` runs without `--target` and `active` lists two or more ids
- **THEN** compile MUST fail with guidance to pass `--target <id>` and MUST not write compile output
