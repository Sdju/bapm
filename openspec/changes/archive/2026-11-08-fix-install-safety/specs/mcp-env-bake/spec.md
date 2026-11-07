## ADDED Requirements

### Requirement: Baked values are not persisted in the lockfile

When install records MCP servers in the lockfile inventory, it MUST record the server declaration as authored before bake: placeholder strings (`${VAR}`, `${env:VAR}`, `<VAR>`, `{bake:VAR}`) MUST appear verbatim and values resolved from the process environment, overrides, or manifest `env` MUST NOT appear in any lockfile (shared or personal). Host MCP configuration files MAY still contain baked values per the host's bake mode.

#### Scenario: Token stays out of the lock

- **WHEN** a direct MCP server declares `env.API_TOKEN: "${API_TOKEN}"`, `API_TOKEN=secret-123` is set in the process environment, and install bakes it into the host MCP config
- **THEN** the written `bapm.lock.yaml` MUST contain `${API_TOKEN}` for that server and MUST NOT contain `secret-123`

#### Scenario: bake directive stays out of the lock

- **WHEN** a server declares `env.KEY: "{bake:KEY}"` and `KEY` resolves to `k-value`
- **THEN** the lock MUST record `{bake:KEY}` and MUST NOT contain `k-value`
