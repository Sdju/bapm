## Why

M1–M8 delivered Consumer floor through install, cursor materialize, lifecycle, producer, and governance policy—but APM product extras remain gaps: Cursor MCP is never written to `.cursor/mcp.json`, there is no `compile` → `AGENTS.md`, and no thin `cache` UX. M9 closes those extras (plus OpenAPM **sc-009** executable trust when MCP deploys) without a new OpenAPM class or second host target.

## What Changes

- **Cursor MCP on install:** resolve/collect direct `dependencies.mcp` (transitive default off / `--trust-transitive-mcp`); when cursor target is active, write/update `.cursor/mcp.json` (`mcpServers` stdio/http) via **`bapm-target-cursor`** under registered `.cursor/` root only; update lock `mcp_*` fields; idempotent owned-key overwrite
- **Executable trust (sc-009):** when consuming manifest has `allowExecutables` / `executables.allow` (documented alias set), MCP from unapproved deps MUST NOT deploy—fail closed; non-executable primitives MAY still materialize; full `approve`/`deny` CLI is SHOULD only
- **Thin `bapm compile`:** discover primitives (reuse M4); emit deterministic **`AGENTS.md`** for cursor host only; `--validate` SHOULD (no write); no multi-host outputs
- **Thin `bapm cache`:** `info` (modules-cache root + size/counts) and `clean` (confirm / `-y`); MUST NOT break rs-016 identity isolation
- **Invariants:** dual-read unchanged; **MUST NOT** add new `bapm-target-*`; FEOD for CLI/core; hard-error unknown flags; M3–M8 regression green without MCP deps
- **SHOULD (soft, not pass-bar):** thin `mcp` / `approve`/`deny` CLI; sc-011/012; cache prune; compile build-id / `--clean`
- **HARD:** packages `@bapm/core`, `@bapm/cli`, `bapm-target-cursor` (+ `bapm-target-api` only if MCP configure contract needed)

## Capabilities

### New Capabilities

- `cursor-mcp-deploy`: Collect direct MCP deps; write Cursor `.cursor/mcp.json` via cursor target; lock `mcp_*` populate; ownership/idempotency; detect-honesty (no mkdir solely for MCP on auto-detect)
- `executable-mcp-trust`: sc-009 fail-closed gate when allowExecutables / executables.allow present; approve vocabulary aliases; withhold diagnostic; non-exec primitives still ok
- `compile-agents-md`: Thin `bapm compile` → `AGENTS.md` from discovered primitives; cursor default; optional `--validate`; no multi-host emit
- `cache-cli-ux`: Thin `bapm cache info|clean` over modules-cache root; preserve rs-016; optional later prune

### Modified Capabilities

- `install-pipeline`: After policy gate, integrate MCP deploy + sc-009 trust before/with durable MCP config writes; skip MCP when cursor inactive per detect honesty
- `target-cursor-minimal`: Lift M5 “never write mcp.json”; MUST write/update `.cursor/mcp.json` when MCP deploy applies under registered roots only
- `target-api-contracts`: Optional host-agnostic MCP configure hook (cursor implements); still no multi-host catalog
- `cli-runtime-surface`: Help/dispatch for `compile`, `cache` (and MCP path via install and/or thin `mcp`); hard-reject unknown flags
- `cli-feod-architecture`: Thin FEOD handlers/modules for compile, cache, MCP integrate, trust gate; no business logic in `commands/`/`app/`
- `core-feod-architecture`: Core modules for MCP collect/deploy orchestration, executable trust, compile emit, cache stats—directory modules + public API; no core→cursor hard dep
- `target-package-architecture`: Reaffirm allow-list only `bapm-target-api` + `bapm-target-cursor`; forbid new hosts in M9
- `lockfile-yaml-rw`: Populate/update `mcp_servers` / `mcp_configs` / provenance consistently when MCP install writes configs (preserve unknown keys)

## Impact

- **`bapm-target-cursor`:** MCP configure path writing `.cursor/mcp.json`; README/detect honesty unchanged for auto-detect
- **`bapm-target-api`:** optional generic configure/MCP report contract if install must stay host-agnostic
- **`@bapm/core`:** MCP collect + trust gate + compile AGENTS emit + cache info/clean helpers; install orchestration wires MCP after policy
- **`bapm` CLI:** `compile`, `cache info|clean`; optional SHOULD `mcp` / `approve`/`deny`
- **Out of scope (explicit DEFER):** marketplace; plugin init; multi-host compile; shared APM git/http cache; `run`/`preview`/`runtime`/`config`/`experimental`/`find`/`view`; publish/self-update (**M10**); claiming a new OpenAPM class solely from M9
