## Why

Authors who know which host harnesses to materialize still must pass `--target` or rely on filesystem auto-detect. Object-map / legacy `target`/`targets` only declare preference, intersection, and integration packages — they do not select the active host. Projects without detect signals (or with ambiguous multi-host trees) fail closed even when the intent is obvious in the manifest.

## What Changes

- Add a first-class manifest field `active:` (non-empty list of mf-005 host tokens) as a **bapm extension** that names which registered hosts to materialize.
- Selection priority becomes: CLI `--target` / forced override → non-empty manifest `active` → sole auto-detect → fail-closed.
- Install (and MCP configure on those hosts) materializes **each** id in `active` when multi-valued; unknown / unregistered ids fail closed after map load.
- Keep `target` / `targets` semantics unchanged for declared preference, intersection, and dynamic integration load — they still do not activate hosts by themselves.
- Dual-read `bapm.yml` / `apm.yml`; document in config-manifest + install guide.
- Compile remains single-host: sole `active` entry may select; multiple `active` ids without `--target` fail with guidance to force one id.
- Empty `active: []` is rejected fail-closed (misconfiguration), not treated as “skip materialize”.

**Non-goals:** changing OpenAPM `target`/`targets` vocabulary; inventing `--target all`; multi-compile outputs; replacing object-map load rules; making map keys auto-activate.

## Capabilities

### New Capabilities

- `manifest-active-targets`: Parse/validate `active`, wire it into host selection for install/MCP (multi) and compile (single), with fail-closed empty/unknown rules and docs.

### Modified Capabilities

- `manifest-yaml-validate`: Accept and validate top-level `active` as a non-empty mf-005 token list; dual-read parity.
- `install-pipeline`: Selection order includes manifest `active`; multi-active materialize; update “explicit or unambiguous detect only” wording.
- `target-integration-dynamic-load`: Clarify that map still does not activate hosts, but `active` (alongside `--target` / detect) may.
- `cli-runtime-surface`: Help/install/compile guidance mentions manifest `active` as an alternative to `--target` when detect is missing/ambiguous.
- `compile-agents-md`: Compile may use a sole manifest `active` id; multi-active without `--target` fails closed.

## Impact

- `@bapm/core` Manifest parse/types; Install `resolveActiveTargets` (and compile selection) consume manifest `active`.
- `@bapm/cli` thin forwarding already passes force target; may need to load/pass active from discovered manifest or rely on core reading the loaded document.
- VitePress `apps/docs` guide/config-manifest + install/compile reference situations.
- No new runtime packages; OpenAPM wire: `active` is a documented bapm extension (cf. object-map / `local`), not a claimed OpenAPM required field.
