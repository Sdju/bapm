## Why

`bapm doctor` already runs project-oriented checks (git / manifest / lockfile / modules) but rejects `-v`/`--verbose` as unknown and emits only compact messages. APM accepts `--verbose` and prints richer detail; bapm needs the same CLI shape without copying marketplace authoring probes, so offline CI stays truthful and exit semantics stay critical-only.

## What Changes

- Accept `-v` / `--verbose` on `bapm doctor`; document them in doctor help; wire into core `RunDoctorOptions`.
- With `verbose`, enrich messages for the four domains: git version (or miss reason); manifest path + name/version when present; lockfile path + `lockfile_version` and/or dependency count when present; modules path + exists/entry-count (or absent).
- Keep default (non-verbose) PASS/FAIL table usable; critical fail → exit ≠ 0; all-critical-ok → 0; no regression of core §22–23 / CLI sane-project doctor.
- Unknown flags other than `-v`/`--verbose`/`-h`/`--help` stay fail-closed (`Unknown doctor flag: …`).
- SHOULD: thin **network** probe (`git ls-remote`, bounded timeout) as **informational or verbose-only** (never critical unless product later opts in); thin **auth-env** informational row (token env presence only, no secret values).
- MUST NOT add marketplace / format / duplicate / version-alignment / executable-trust rows; no CONFORMANCE churn; no `--global` / multi-target doctor.

**Non-goals:** Marketplace doctor domains; `AuthResolver` / `gh` CLI as required checks; executable-trust → `policy explain`; CONFORMANCE claim-table edits; changing which critical checks run based on `-v` alone.

## Capabilities

### New Capabilities

- _(none)_ — extends existing doctor + CLI surfaces.

### Modified Capabilities

- `doctor-basics`: honor `verbose` with richer truthful detail on git/manifest/lock/modules; keep critical exit semantics; optional thin network (informational/verbose-only) + auth-env informational; explicitly exclude marketplace-style rows.
- `cli-runtime-surface`: `doctor` accepts `-v`/`--verbose`; help documents them; other unknown doctor flags remain hard-error.

## Impact

- `@bapm/core` `Doctor` module: `RunDoctorOptions.verbose`, richer probe messages, optional network/auth checks.
- `bapm` CLI Doctor module: `parseDoctorArgs` / `formatDoctorHelp` / pass `verbose` to core.
- Tests: acceptance (default + verbose + unknown-flag) + extend core doctor / CLI doctor suites; no harness deploy from doctor.
- No CONFORMANCE / claim-table edits; no marketplace diagnostics.
