## MODIFIED Requirements

### Requirement: Merge precedence flags then local then base then env

Effective settings MUST apply layers in this order of increasing precedence (higher wins on conflict): process-env overrides for a setting (only when that setting has an env override) < base dual-read manifest < `bapm.local.yml` < direct CLI flags. Equivalently, consumers MUST resolve as: **CLI flags → `bapm.local.yml` → base `bapm.yml`/`apm.yml` → env overrides**. Forced `--target` MUST override effective resolved target ids from local or base `active` for that run.

MCP placeholder resolution is the exception defined by `mcp-env-bake`: when baking `${VAR}` / `{bake:VAR}`, a non-empty process environment value MUST win over the merged manifest `env` map, and within that map `bapm.local.yml` values MUST win over base manifest values.

#### Scenario: Local active overrides base active

- **WHEN** base has `active: { target: cursor }` and `bapm.local.yml` has `active: { target: x-acme-editor }`, and install runs without `--target`
- **THEN** effective activation MUST use `[x-acme-editor]` (subject to registration gates)

#### Scenario: CLI --target overrides local active

- **WHEN** `bapm.local.yml` has `active: { target: x-acme-editor }` and the user passes `--target cursor`
- **THEN** the run MUST activate only `cursor`

#### Scenario: Process env wins for MCP placeholders

- **WHEN** base `env.API_TOKEN` is `base`, `bapm.local.yml` `env.API_TOKEN` is `local`, process env `API_TOKEN` is `proc`, and an MCP server declares `${API_TOKEN}`
- **THEN** the baked value MUST be `proc`; without the process variable it MUST be `local`
