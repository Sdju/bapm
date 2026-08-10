## Why

OpenAPM v0.1 **req-lk-018** (SHOULD, Consumer, §5.5) asks a conforming consumer to default to frozen-install behaviour when the `CI` environment variable is truthy, with an explicit non-frozen override. After M1–M10 and P1 (lk-015), bapm still requires callers to pass `--frozen` manually; M5 deferred lk-018 as optional. Closing this SHOULD is the P2 parity stage and hardens CI installs without changing non-CI developer UX.

## What Changes

- Detect a truthy `CI` env (OpenAPM definition) and treat plain `bapm install` as frozen unless the user opts out.
- Add an explicit non-frozen opt-out flag (`--no-frozen`) so CI workflows that intentionally rewrite the lock can override the SHOULD-default.
- Keep `--frozen` as an explicit force-on; reject frozen (including CI-default) combined with `--update` the same way as today.
- Lift the install-pipeline note that “Default-frozen-on-CI (lk-018) remains optional”.
- **Non-goals:** multi-target adapters; P3 Mode B / CONFORMANCE.md; P4 Governance remote/`extends`; P5 broad docs beyond minimal help/notes required by design; reopening P1 lk-015; inventing vendor-specific CI env lists beyond OpenAPM’s `CI` variable; changing `audit --ci` semantics.

## Capabilities

### New Capabilities

- _(none)_ — behaviour extends existing install/CLI surfaces.

### Modified Capabilities

- `install-pipeline`: Promote lk-018 from deferred/optional to required SHOULD behaviour — CI-truthy defaults install to frozen; explicit non-frozen override clears the default; frozen semantics (pins, lock immutability, hash/`tree_sha256` re-verify) apply unchanged when the effective mode is frozen.
- `cli-runtime-surface`: Wire CI-default frozen and `--no-frozen` on the install command; document in install help; preserve `--frozen` / frozen+`--update` rejection with CI-default included.

## Impact

- `@b-apm/core`: small shared helper to interpret OpenAPM CI truthiness and resolve effective `frozen` from flags/env (usable by CLI and library callers).
- `bapm` CLI: `parseInstallArgs` / install runner honor `CI` + `--no-frozen` / `--frozen`; help text.
- Acceptance/unit tests: CI env → frozen without `--frozen`; `--no-frozen` under CI stays non-frozen; non-CI unchanged; frozen+update still rejected when CI-default applies.
- Follow-on (out of scope): P3 Mode B, P4 Governance, P5 docs, multi-target.
