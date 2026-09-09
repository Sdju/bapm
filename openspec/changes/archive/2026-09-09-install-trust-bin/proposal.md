## Why

APM 0.29.0 (#1620, #2508) adds `apm install --trust-bin` / `--no-trust-bin` so marketplace/plugin `bin/` executables get **per-invocation** consent without rewriting project or user policy. bapm already ships layered `ExecutableTrust` + `approve`/`deny` for MCP (sc-009–012) but still treats hooks/bin/canvas as soft ungated and has **no** install flags for bin consent—so non-interactive / CI installs cannot refuse plugin bin deploy the way upstream APM does.

## What Changes

- Add mutually exclusive `bapm install --trust-bin` and `--no-trust-bin` (unknown-flag hard fail; help documents both).
- Thread an effective bin-consent option into `@b-apm/core` install: flags are a **per-invocation override** on top of existing org/project/user `ExecutableTrust` for executable type `bin`—they MUST NOT re-enable an org/project deny.
- **Non-interactive** installs (truthy `CI`, `BAPM_NON_INTERACTIVE`, non-TTY stdin, or effective `--frozen`) MUST default to **skip/refuse bin deploy** unless `--trust-bin` or a persisted allow (project/user grant for `bin`) already permits after the deny-wins ladder.
- **Interactive** path: neither flag → deploy with a clear trust-posture warning (APM parity) when the policy ladder allows; `--trust-bin` deploys without that warning; `--no-trust-bin` skips even when policy would allow.
- When dependency packages ship deployable `bin/` content, install MUST apply the consent gate before materializing those binaries; withheld bins MUST NOT silently land on disk, while non-executable primitives continue.
- Update soft-honesty / Limitations: **bin** is no longer ungated soft debt; hooks/canvas remain MCP-adjacent soft (out of this change).
- Docs: install help + short guide/reference callout for the flags and non-interactive default.

### Non-goals (this change)

- Exclusive plugin.json `skills:` declaration; Copilot native Agent Plugins; `pack --check-versions` + plugin.json-only pack; OpenAPM req-pl-018; policy canonical identity casing.
- Hermes, grok-cloud, Homebrew / `install.sh`, Authenticode, gh-aw.
- Opening soft gates for **hooks** or **canvas**.
- Full APM approve UX (`--all` / `--recommended` / `policy explain`); duplicating a second trust ladder beside `resolveExecutableTrust`.
- Global `-g` / `--global` install surface; deps object `skills:`/`targets:` subset (already shipped).
- `.bapmignore` (already shipped).

### Follow-ups (not tasks of this change)

1. `plugin-skills-declaration-exclusive`
2. `copilot-native-agent-plugins`
3. `pack-check-versions-plugin-json`
4. `policy-canonical-identity-casing`

## Capabilities

### New Capabilities

- `install-trust-bin`: Per-invocation `--trust-bin` / `--no-trust-bin` consent for dependency/plugin `bin/` deploy, non-interactive default skip, and layering over existing ExecutableTrust without a parallel policy store.

### Modified Capabilities

- `cli-runtime-surface`: Install accepts and documents `--trust-bin` / `--no-trust-bin`; mutual exclusion; help text.
- `install-pipeline`: Core install options carry trust-bin consent; bin deploy is gated; non-interactive default skip; withhold diagnostics without failing non-bin materialize.
- `executable-mcp-trust`: Soft-honesty requirement narrows: hooks/canvas remain ungated; **bin** is gated via shared resolver + invocation consent (no second ladder).

## Impact

- `@b-apm/cli` Install parse/help + forward flags to core.
- `@b-apm/core` Install options + bin consent resolution (reuse `resolveExecutableTrust` with `executableType: "bin"`); discovery/materialize path for package `bin/` candidates; diagnostics when skipped.
- `ExecutableTrust` grant entries already allow typed keys (`bin: true`); approve/deny MAY persist `bin` grants without a new store format.
- `apps/docs` install help / security or install guide note; `CONFORMANCE.md` / Limitations soft wording (bin no longer listed as ungated with hooks/canvas).
- Tests: CLI parse/help; core consent matrix (interactive / non-interactive / flags / deny-wins); install skip vs deploy fixture with `bin/`.
