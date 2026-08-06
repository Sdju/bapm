## Purpose

Defines offline helpers that validate plugin identities and write the thin producer scaffold files `plugin.json` and plugin-mode `bapm.yml` without network I/O or extra authoring artifacts.

## ADDED Requirements

### Requirement: Plugin name kebab-case validation
The system MUST expose a plugin-name validator whose accepted shape matches `^[a-z][a-z0-9-]{0,63}$` (starts with a letter; lowercase letters, digits, hyphens; at most 64 characters). Names with uppercase, underscore, leading digit or hyphen, empty string, or length greater than 64 MUST be rejected.

#### Scenario: Valid kebab-case accepted
- **WHEN** the validator is given `my-plugin`
- **THEN** the name MUST be accepted

#### Scenario: Uppercase rejected
- **WHEN** the validator is given `MyPlugin`
- **THEN** the name MUST be rejected

#### Scenario: Too long rejected
- **WHEN** the validator is given a string longer than 64 characters that otherwise looks kebab-case
- **THEN** the name MUST be rejected

### Requirement: plugin.json writer fields
Writing `plugin.json` MUST produce valid JSON with a trailing newline and indent width 2, containing string fields `name`, `version`, `description`, object `author` with string `name`, and string `license` equal to `"MIT"`. When scaffolding under non-interactive `--yes` defaults, `version` MUST be `0.1.0`.

#### Scenario: Default yes plugin.json shape
- **WHEN** a plugin.json is written for name `demo-plugin` with non-interactive defaults
- **THEN** parsing the file MUST yield `name` `demo-plugin`, `version` `0.1.0`, string `description`, `author.name` as a string, `license` `"MIT"`, and the file MUST end with a newline

### Requirement: Plugin-mode bapm.yml scaffold
Plugin-mode minimal manifest write MUST create `bapm.yml` (not `apm.yml`) containing at least non-empty `name`, string `version` (`0.1.0` under non-interactive `--yes` defaults), `dependencies` with `apm` and `mcp` lists (empty lists allowed), and `devDependencies` with an `apm` list (empty allowed). The write MUST NOT require consumer project init to gain `devDependencies`. The scaffold MUST NOT create `SKILL.md` or empty `agents/` / `skills/` directories.

#### Scenario: Plugin-mode manifest includes devDependencies.apm
- **WHEN** a plugin-mode minimal manifest is written for a valid plugin name with non-interactive defaults
- **THEN** `bapm.yml` MUST parse with `version` `0.1.0`, empty-or-list `dependencies.apm` and `dependencies.mcp`, and present `devDependencies.apm`

#### Scenario: Consumer minimal create remains without required devDependencies
- **WHEN** a non-plugin minimal consumer manifest is created via existing consumer init helpers
- **THEN** the document MUST NOT be required to include `devDependencies` solely because plugin-mode scaffolding exists

### Requirement: Scaffold helpers are offline
Plugin scaffold helpers (name validation, `plugin.json` write, plugin-mode `bapm.yml` write) MUST NOT perform network, marketplace, or registry I/O.

#### Scenario: Writers do not touch network
- **WHEN** plugin scaffold helpers run in isolation
- **THEN** they MUST complete using only local filesystem and in-memory inputs with no HTTP or registry client calls
