## ADDED Requirements

### Requirement: configureMcp persists bake-resolved env and headers

When Cursor `configureMcp` writes `mcpServers` entries, `env` and `headers` values that participated in bake-time resolution MUST be the baked literals (or omit unresolved maps by failing before write). The integration MUST NOT invent Cursor runtime env-substitution as a replacement for bake. Literal env maps without placeholders MUST continue to round-trip as today.

#### Scenario: configureMcp writes baked env literals

- **WHEN** configureMcp receives (or bake-resolves) a server whose env placeholder resolved to a literal
- **THEN** `.cursor/mcp.json` under the registered `.cursor/` root MUST store that literal under `mcpServers.<name>.env`

#### Scenario: Plain env without placeholders still writes

- **WHEN** configureMcp receives a server with `env: { FOO: "bar" }` and no placeholders
- **THEN** `.cursor/mcp.json` MUST still contain `FOO: "bar"` as today
