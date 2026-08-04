## 1. Target API + cursor MCP writer

- [x] 1.1 Extend `bapm-target-api` with optional host-agnostic MCP configure contract (capability/method + path report); keep no multi-host catalog
- [x] 1.2 Implement Cursor `configureMcp` (or equivalent) in `bapm-target-cursor`: write/update `.cursor/mcp.json` (`mcpServers` stdio/http) under registered `.cursor/` only; idempotent owned keys
- [x] 1.3 Update cursor README/tests: lift blanket “never mcp.json”; keep skills/rules/agents materialize free of MCP side effects; assert roots never escape
- [x] 1.4 Confirm detect honesty: auto-detect without force still MUST NOT mkdir `.cursor/` solely for MCP

## 2. Core executable trust (sc-009)

- [x] 2.1 Add core directory module(s) for executable trust: parse `executables.allow`/`deny` + documented `allowExecutables` alias
- [x] 2.2 Fail-closed gate: when grant surface present, unapproved dep MCP MUST NOT deploy; clear withhold diagnostic / non-zero; approved packages pass
- [x] 2.3 Ensure non-executable primitives still materialize when MCP withheld; export via `app/publicApi`

## 3. Core MCP collect + install wire

- [x] 3.1 Collect direct `dependencies.mcp`; default skip transitive unless `--trust-transitive-mcp`
- [x] 3.2 Wire install after policy gate: trust → configureMcp via target-api registry when cursor active; skip MCP when cursor inactive per detect honesty
- [x] 3.3 Populate lock `mcp_*` fields on write-back when MCP configs written; preserve unknowns/`x-*`
- [x] 3.4 Projects without MCP: install MUST NOT require `.cursor/mcp.json` (M5 regression)

## 4. Thin compile → AGENTS.md

- [x] 4.1 Add core `Compile` module: reuse Primitives discovery; emit deterministic `AGENTS.md` (stable sort; optional build-id if cheap)
- [x] 4.2 Support `--validate` (no durable write); MUST NOT emit multi-host files (CLAUDE/GEMINI/copilot)
- [x] 4.3 CLI FEOD: `commands/compile` + module adapter; register in app; hard-reject unknown flags; help lists `compile`

## 5. Thin cache info|clean

- [x] 5.1 Add core `Cache` helpers over modules-cache root (project `apm_modules` / documented root): info stats (size/entries), clean with `-y` / non-silent confirm
- [x] 5.2 Preserve rs-016 identity isolation; do not introduce shared APM git/http cache
- [x] 5.3 CLI FEOD: `commands/cache` (`info`|`clean`) + module; help lists `cache`

## 6. CLI install flags + docs

- [x] 6.1 Expose trust-transitive-MCP flag on install; document MCP/cursor path in install help
- [x] 6.2 Keep unknown flags hard-error; FEOD thin handlers only; core via `app/integrations`

## 7. Optional SHOULD (later / non-blocking)

- [ ] 7.1 Thin `bapm mcp` group (`install` alias / `list`/`show`; registry search stub or “unsupported”)
- [ ] 7.2 Thin `bapm approve` / `bapm deny` (+ optional `--user` user-local; sc-010 if interactive)
- [ ] 7.3 sc-011 deny-wins vs M8 policy executables; sc-012 diagnostics when require + MCP withheld
- [ ] 7.4 `bapm cache prune --days N`; compile `--clean` / constitution block if cheap

## 8. Package graph + verification (apply only)

- [x] 8.1 Confirm workspace still only `bapm-target-api` + `bapm-target-cursor` among `bapm-target-*`; no core→cursor hard dep
- [x] 8.2 Dual-read: apm.yml-only and bapm.yml-only still work for install/compile/MCP
- [x] 8.3 M3–M8 regression green without MCP deps; M8 policy still runs before durable MCP/modules writes
- [x] 8.4 Run build/test/`vp check` for `@bapm/core`, `bapm`, `bapm-target-api`, `bapm-target-cursor`; fix in-scope regressions
