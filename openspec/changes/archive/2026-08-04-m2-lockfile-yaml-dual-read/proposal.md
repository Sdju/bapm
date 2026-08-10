## Why

Drop-in parity with APM/OpenAPM needs lockfile read/write in `@b-apm/core`: parse, validate, serialize, and dual discovery of `apm.lock.yaml` / `bapm.lock.yaml`. Without M2, later resolve/install cannot round-trip an OpenAPM §5 lock or load existing APM project locks. Dual-read mirrors M1 branding while keeping OpenAPM wire compatibility.

## What Changes

- Add lockfile YAML parse / validate / serialize / round-trip in `@b-apm/core` aligned with OpenAPM §5 MUST for M2 (`req-lk-001`, `002` monotonic, `003` shape, `004`, `005` sort `(repo_url, virtual_path)` + semantic equivalence, `011`, `014`, `016`, `019`, `022`) plus hash envelope normalize
- Add dual-file discovery: `apm.lock.yaml` **or** `bapm.lock.yaml` (explicit path wins; both → hard error; cwd = project root, no walk-up; write-back same loaded name; fresh create → `bapm.lock.yaml`)
- Default absent `lockfile_version` to `"1"` on read; always emit version on write; preserve unknown top-level/entry fields (including APM `deployments` / `lsp_*` / MCP blocks) without first-class modeling
- Accept shape for deferred runtime fields (`req-lk-008` / `012` / `013` / `015`) without resolve/download/hash compute
- Expose core API suitable for acceptance (thin CLI optional; not required to close M2)
- **Non-goals:** resolve / download / install / frozen CI / targets / deploy / full lock pipeline / legacy `apm.lock` migration / in-tree target adapters (`target-package-architecture` unchanged — lockfile M2 does not touch targets)

## Capabilities

### New Capabilities

- `lockfile-dual-file-discovery`: Resolve which lockfile to load (`apm.lock.yaml` / `bapm.lock.yaml` / explicit path), dual-conflict and missing-file errors, write-back same name, fresh-create default `bapm.lock.yaml`
- `lockfile-yaml-rw`: Safe YAML load, OpenAPM/APM lockfile shape validate, serialize (omit unset, sort, monotonic v2, hash envelopes), round-trip unknown/`x-*`, semantic equivalence helper

### Modified Capabilities

- (none — `target-package-architecture` and M1 manifest specs stay as-is; M2 does not add target or manifest requirements)

## Impact

- **Primary package:** `@b-apm/core` only — new/extended `lockfile` module (types, parse, serialize, discovery, public exports); reuse M1 YAML safe-subset loader
- **Tests (later phase):** acceptance under core for checklist C in `.samples/apm-knowledge/topics/m2-lockfile-acceptance.md`; port OpenAPM lock fixtures; exercise real APM `apm.lock.yaml` bytes via discovery
- **CLI:** optional thin dump/load only; full `lock` pipeline is M3+
- **Out of scope:** resolve, download, install, frozen, targets/`bapm-target-*`, deploy ledgers as first-class, CLI FEOD changes, packages outside `@b-apm/core`
