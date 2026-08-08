## ADDED Requirements

### Requirement: MCP deploy and trust after policy gate

After the M8 policy gate (when applicable) and before or as part of durable target harness writes, install MUST run executable MCP trust (sc-009) and Cursor MCP deploy for eligible servers when the cursor target is active. Blocking trust withhold MUST prevent writing the withheld MCP entries. Policy block MUST still stop modules/deploy before MCP writes. Projects without MCP MUST keep existing modules+skills paths unchanged.

#### Scenario: Policy block precedes MCP write

- **WHEN** install has a blocking policy violation on the plan
- **THEN** install MUST NOT write `.cursor/mcp.json` for that plan

#### Scenario: Trust withhold skips MCP entry

- **WHEN** policy allows the plan but sc-009 withholds a dependency's MCP
- **THEN** that MCP entry MUST NOT appear in `.cursor/mcp.json`

#### Scenario: Eligible MCP deploys with cursor active

- **WHEN** policy allows, trust approves (or no grant surface), cursor is active, and direct MCP exists
- **THEN** `.cursor/mcp.json` MUST be updated and lock `mcp_*` fields MUST reflect configured servers

### Requirement: Install accepts transitive MCP trust flag

Install options MUST accept an explicit trust-transitive-MCP flag (name MAY mirror APM `--trust-transitive-mcp`). Default MUST keep transitive MCP undeployed.

#### Scenario: Trust transitive flag enables transitive MCP

- **WHEN** install is invoked with the trust-transitive-MCP flag and a transitive MCP server is present with cursor active and trust allows
- **THEN** that transitive MCP MAY be deployed per documented rules
