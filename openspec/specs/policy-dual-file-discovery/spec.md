# policy-dual-file-discovery Specification

## Purpose

Discovers which local policy file applies using dual-read branding (`apm-policy.yml` | `bapm-policy.yml`) with explicit override, conflict detection, and no parent-directory walk—matching M1/M2 dual-read posture for Governance.

## Requirements

### Requirement: Local dual-read policy filenames
Local discovery MUST recognize constants equivalent to `APM_POLICY_FILE = "apm-policy.yml"` and `BAPM_POLICY_FILE = "bapm-policy.yml"`. Content schema MUST be identical regardless of filename; filename is discovery only.

#### Scenario: Only apm-policy.yml
- **WHEN** only `apm-policy.yml` exists at the project root
- **THEN** discovery MUST resolve that path

#### Scenario: Only bapm-policy.yml
- **WHEN** only `bapm-policy.yml` exists at the project root
- **THEN** discovery MUST resolve that path

### Requirement: Both local policy files hard-conflict
When both `apm-policy.yml` and `bapm-policy.yml` exist at the scanned project root, discovery MUST fail with a hard error naming both paths. The system MUST NOT merge or prefer one silently.

#### Scenario: Dual conflict error
- **WHEN** both policy filenames are present at the project root and no explicit path is given
- **THEN** discovery MUST fail and the error MUST name both paths

### Requirement: Neither file means absent local policy
When neither filename exists at the project root, local discovery MUST report absent (not an error by itself). Downstream MUST treat this as no local policy from this provider.

#### Scenario: Neither present
- **WHEN** the project root has neither policy file
- **THEN** local discovery MUST report absent without throwing a dual-conflict error

### Requirement: Explicit policy path wins
An explicit policy path (CLI `--policy` or API equivalent pointing at a concrete file) MUST win over dual-read sibling search. Sibling dual-conflict MUST NOT apply when an explicit path is supplied. A missing explicit file MUST fail closed on load.

#### Scenario: Explicit path ignores sibling
- **WHEN** both brand files exist and an explicit path to one of them is provided
- **THEN** discovery MUST use the explicit path and MUST NOT raise dual-conflict

#### Scenario: Explicit missing file fails
- **WHEN** an explicit policy path does not exist
- **THEN** load MUST fail with a clear missing-file error

### Requirement: No parent directory walk
Local policy discovery MUST scan only the configured project root / cwd (no walking parent directories for `*-policy.yml`).

#### Scenario: Parent-only policy is absent
- **WHEN** a policy file exists only in a parent directory and discovery runs with cwd set to a child project root
- **THEN** local discovery MUST report absent

### Requirement: Local provider remains dual-read within ordered list
The `local` discovery provider MUST continue to apply dual-read branding (`apm-policy.yml` | `bapm-policy.yml`), explicit-path override, dual-conflict, neither-absent, and no parent walk exactly as before. It MUST participate as one named entry in the ordered provider list rather than being the sole discovery mechanism.

#### Scenario: Local dual-read still applies
- **WHEN** only `bapm-policy.yml` exists at project root and the `local` provider is invoked
- **THEN** discovery MUST resolve that path

### Requirement: Ordered providers local-only for M8
Discovery MUST be modeled as an ordered list of selectable providers (pl-001/011). The registered default provider list MUST include the `local` dual-read provider and the OpenAPM-named remote provider `github-owner-dotgithub` in a documented implementation-defined order. The default order MUST appear in the published conformance statement. Additional APM-only cascades (ADO, `.apm`/`_apm` multi-candidate) MUST NOT be required.

#### Scenario: Default provider list includes local and remote
- **WHEN** documenting or querying the default discovery provider order after P4
- **THEN** the list MUST include `local` and `github-owner-dotgithub` and MUST document that order in the conformance statement

#### Scenario: Local-only selection still possible
- **WHEN** a project selects only the `local` provider via `discovery:`
- **THEN** discovery MUST NOT invoke `github-owner-dotgithub`
