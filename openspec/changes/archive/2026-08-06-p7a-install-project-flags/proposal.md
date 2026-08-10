## Why

After P6a, bapm install still lacks APM project-scope leftover flags: `--force`, dual-consent HTTP insecure policy (`--allow-insecure` / `--allow-insecure-host`), `--dev` (write + resolve), and `--only apm|mcp`. Closing this parity slice keeps cursor-only install usable without claiming `--global`, multi-target, or untruthful `--refresh`.

## What Changes

- CLI accepts and help-lists `--force`, `--allow-insecure`, repeatable `--allow-insecure-host <hostname>`, `--dev`, `--only <apm|mcp>` (reject other values); wire into `@b-apm/core` install options.
- Enforce **dual-gate** for direct `http://` deps: fail-closed unless both manifest `allow_insecure: true` on the object entry **and** `--allow-insecure`; APM-shaped remediation text.
- Enforce transitive HTTP host allowlist from `--allow-insecure-host` (+ hosts contributed by approved direct insecure URLs); invalid hostname fail-closed at parse.
- `--dev` + positional package-ref → write `devDependencies.apm` (create block if needed); without positional, no invented side effects.
- Root resolve/install **merges** `devDependencies.apm` with `dependencies.apm` so local install includes both (APM parity).
- `--only apm` skips MCP configure; `--only mcp` skips APM package download/materialize (preserve existing lock MCP restoration where present).
- `--force` accepted; **cursor collision half N/A** (always-overwrite today); MUST NOT refresh refs, bypass frozen, or disable policy.
- **Omit `--refresh`** in this change (DEFER until a truthful modules re-fetch story exists; do not fake APM shared-cache bypass).
- Keep: unknown-flag fail-closed; frozen×positional reject; dry-run zero durable writes; P6a flags unchanged.

**Non-goals:** `--global` / user scope; multi-target; `--mcp`/`--skill` CLI add; CONFORMANCE claim churn; inventing a full install-time security scanner solely for `--force`; shared APM git/http cache; protective collision-skip rewrite in this slice.

## Capabilities

### New Capabilities

- _(none)_ — behaviour extends existing install / CLI / resolve / MCP surfaces.

### Modified Capabilities

- `install-pipeline`: insecure dual-gate + host allowlist; `--dev` write target; `--only` skip sides; `--force` accept with documented N/A collision + no frozen/policy bypass; omit `--refresh`.
- `cli-runtime-surface`: parse/help/wire new flags; reject invalid `--only` and invalid insecure hosts; help notes force ≠ refresh/update.
- `dependency-resolve`: root graph includes `devDependencies.apm` alongside `dependencies.apm` for local install resolve.
- `cursor-mcp-deploy`: honor install-only mode that skips MCP configure (`--only apm`) while package path may still run.

## Impact

- `@b-apm/core` Install options + `runInstall` / `packageRefs`; new insecure policy helper (APM `insecure_policy` intent); Resolver `resolveGraph` root dep union.
- `bapm` CLI Install: `parseInstallArgs` / help / wiring.
- `bapm-target-cursor`: no dry-run/force API growth; collision remains always-overwrite (documented).
- Tests: unit/CLI for dual-gate, host allowlist, `--dev`, `--only`, `--force` accept + frozen/policy non-bypass.
- No CONFORMANCE.md / claim-table edits; no `--global`.
