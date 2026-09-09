## Why

Producer `pack` walks nearly the whole project tree (minus a few hard excludes), and registry `publish` optionally ships root docs (`README.md`, `CHANGELOG.md`, …). Authors often keep authoring-only files next to skills/packages that must not land in the distributable archive. There is no npm-style ignore file today, so teams either ship noise or delete files before pack.

## What Changes

- Introduce a project-root **`.bapmignore`** file: gitignore-style patterns that **silently omit** matching paths from producer pack collection and from flat registry publish archives.
- Apply ignore after hard excludes (`.git`, `node_modules`, `*.zip`, personal overlay/lock) and **before** secret-pattern refuse: ignored paths are not packed and do not trigger sc-007 refuse.
- Keep **required** publish/pack inputs fail-closed: patterns MUST NOT strip the dual-read root manifest from the pack set, and MUST NOT strip the required `.apm/` tree (or wire `apm.yml`) from a built publish archive.
- Document the file in pack/publish user docs (and help callouts where appropriate).
- Absence of `.bapmignore` preserves today’s pack/publish file set (no silent adoption of `.gitignore`).

Non-goals:

- Using `.gitignore` as an implicit pack filter when `.bapmignore` is missing (v1 opt-in only via `.bapmignore`).
- Nested / directory-scoped `.bapmignore` files outside the project root.
- Changing secret-pattern refuse semantics, personal-overlay/lock omit rules, or marketplace JSON emit paths.
- A CLI flag to override ignore on a single run (can be a later change).
- Dual-brand rename (no `.apmignore`); the authoring filename is `.bapmignore` only.

## Capabilities

### New Capabilities

- `pack-bapmignore`: discover and parse project-root `.bapmignore`, match paths with gitignore-style rules, and define always-include / fail-closed interactions with pack and publish collectors.

### Modified Capabilities

- `producer-pack-archive`: M7 pack file collection MUST honor `.bapmignore` omissions (and keep required manifest / secret / personal-omit behavior).
- `producer-publish`: flat registry zip construction MUST honor `.bapmignore` for optional root docs and `.apm/**` members (required wire layout still fail-closed).

## Impact

- `@b-apm/core` Pack collector (`collectPackFiles` / walk) and Registry `buildPublishArchive` (optional docs + `.apm` walk); shared ignore helper likely under Pack or a small shared module.
- CLI pack/publish help and `apps/docs` pack/publish reference/guide callouts.
- Tests: unit match semantics + pack/publish archive membership fixtures (README/CHANGELOG omit, required-path protection).
- No new user-facing command; authors add `.bapmignore` beside `bapm.yml` / `apm.yml`.
