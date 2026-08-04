## 1. Target API + cursor MCP writer

- [ ] 1.1 Extend `bapm-target-api` with optional host-agnostic MCP configure contract (capability/method + path report); keep no multi-host catalog
- [ ] 1.2 Implement Cursor `configureMcp` (or equivalent) in `bapm-target-cursor`: write/update `.cursor/mcp.json` (`mcpServers` stdio/http) under registered `.cursor/` only; idempotent owned keys
- [ ] 1.3 Update cursor README/tests: lift blanket “never mcp.json”; keep skills/rules/agents materialize free of MCP side effects; assert roots never escape
- [ ] 1.4 Confirm detect honesty: auto-detect without force still MUST NOT mkdir `.cursor/` solely for MCP

## 2. Core executable trust (sc-009)

- [ ] 2.1 Add core directory module(s) for executable trust: parse `executables.allow`/`deny` + documented `allowExecutables` alias
- [ ] 2.2 Fail-closed gate: when grant surface present, unapproved dep MCP MUST NOT deploy; clear withhold diagnostic / non-zero; approved packages pass
- [ ] 2.3 Ensure non-executable primitives still materialize when MCP withheld; export via `app/publicApi`

## 3. Core MCP collect + install wire

- [ ] 3.1 Collect direct `dependencies.mcp`; default skip transitive unless `--trust-transitive-mcp`
- [ ] 3.2 Wire install after policy gate: trust → configureMcp via target-api registry when cursor active; skip MCP when cursor inactive per detect honesty
- [ ] 3.3 Populate lock `mcp_*` fields on write-back when MCP configs written; preserve unknowns/`x-*`
- [ ] 3.4 Projects without MCP: install MUST NOT require `.cursor/mcp.json` (M5 regression)

## 4. Thin compile → AGENTS.md

- [ ] 4.1 Add core `Compile` module: reuse Primitives discovery; emit deterministic `AGENTS.md` (stable sort; optional build-id if cheap)
- [ ] 4.2 Support `--validate` (no durable write); MUST NOT emit multi-host files (CLAUDE/GEMINI/copilot)
- [ ] 4.3 CLI FEOD: `commands/compile` + module adapter; register in app; hard-reject unknown flags; help lists `compile`

## 5. Thin cache info|clean

- [ ] 5.1 Add core `Cache` helpers over modules-cache root (project `apm_modules` / documented root): info stats (size/entries), clean with `-y` / non-silent confirm
- [ ] 5.2 Preserve rs-016 identity isolation; do not introduce shared APM git/http cache
- [ ] 5.3 CLI FEOD: `commands/cache` (`info`|`clean`) + module; help lists `cache`

## 6. CLI install flags + docs

- [ ] 6.1 Expose trust-transitive-MCP flag on install; document MCP/cursor path in install help
- [ ] 6.2 Keep unknown flags hard-error; FEOD thin handlers only; core via `app/integrations`

## 7. Optional SHOULD (later / non-blocking)

- [ ] 7.1 Thin `bapm mcp` group (`install` alias / `list`/`show`; registry search stub or “unsupported”)
- [ ] 7.2 Thin `bapm approve` / `bapm deny` (+ optional `--user` user-local; sc-010 if interactive)
- [ ] 7.3 sc-011 deny-wins vs M8 policy executables; sc-012 diagnostics when require + MCP withheld
- [ ] 7.4 `bapm cache prune --days N`; compile `--clean` / constitution block if cheap

## 8. Package graph + verification (apply only)

- [ ] 8.1 Confirm workspace still only `bapm-target-api` + `bapm-target-cursor` among `bapm-target-*`; no core→cursor hard dep
- [ ] 8.2 Dual-read: apm.yml-only and bapm.yml-only still work for install/compile/MCP
- [ ] 8.3 M3–M8 regression green without MCP deps; M8 policy still runs before durable MCP/modules writes
- [ ] 8.4 Run build/test/`vp check` for `@bapm/core`, `bapm`, `bapm-target-api`, `bapm-target-cursor`; fix in-scope regressions
