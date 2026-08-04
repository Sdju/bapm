# producer-init Specification

## Purpose

Scaffolds a new bapm project with a conforming dual-read manifest defaulting to `bapm.yml`, matching OpenAPM Producer init obligations without inventing host packages.

## Requirements

### Requirement: Init creates default bapm.yml when none exists
Invoking project init MUST create a top-level YAML mapping manifest at `bapm.yml` (not `apm.yml` by default) containing non-empty string `name` and string `version`. Dual-read discovery rules MUST remain unchanged after write (a single brand file is present). Init with `-y` / `--yes` MUST succeed without interactive prompts using documented defaults.

#### Scenario: Fresh init -y writes bapm.yml
- **WHEN** init runs with `-y` and a project name in an empty directory
- **THEN** `bapm.yml` MUST exist as a parseable dual-read manifest with non-empty `name` and string `version`, and the exit code MUST be `0`

#### Scenario: Init default version is semver-shaped
- **WHEN** init runs with `-y` without an explicit version override
- **THEN** the written `version` MUST match semver 2.0.0 shape (for example `0.1.0`)

### Requirement: Init refuses existing dual-read manifest
Init MUST fail closed with a non-zero exit when either `bapm.yml` or `apm.yml` already exists in the project root. Init MUST NOT overwrite or merge into an existing manifest.

#### Scenario: Existing bapm.yml blocks init
- **WHEN** `bapm.yml` already exists and init is invoked
- **THEN** the exit code MUST be non-zero and the existing file MUST remain unchanged

#### Scenario: Existing apm.yml blocks init
- **WHEN** `apm.yml` already exists and init is invoked
- **THEN** the exit code MUST be non-zero and the existing file MUST remain unchanged

### Requirement: Init never emits workspaces
Init MUST NOT write a top-level `workspaces` key. Written manifests MUST pass OpenAPM Producer parse validation for mf-001..003 and mf-021.

#### Scenario: Init output has no workspaces
- **WHEN** a successful init write is loaded by the manifest parser
- **THEN** the document MUST be accepted and MUST NOT contain top-level `workspaces`

### Requirement: Init target surface is cursor-thin
When init records a host target, it MUST use cursor (or detect `.cursor/`) rather than inventing new `bapm-target-*` packages. Multi-host interactive catalogs beyond a documented thin subset MUST NOT be required for M7.

#### Scenario: Init -y with cursor target
- **WHEN** init runs with `-y` and `--target cursor` (or equivalent)
- **THEN** the written manifest MAY include `target: cursor` or `targets` containing `cursor`, and MUST NOT require a new host target package

### Requirement: CLI init command is registered
Invoking `init` MUST be recognized by CLI dispatch and MUST invoke a thin FEOD command → module path that performs scaffold via `@bapm/core`. Unknown flags on `init` MUST hard-error with non-zero exit.

#### Scenario: init is not unknown
- **WHEN** `runCli(["init", "--help"])` or `runCli(["init", "-y", "demo"])` is called
- **THEN** the CLI MUST NOT treat `init` as an unknown command

#### Scenario: Unknown init flag fails
- **WHEN** `runCli(["init", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag
