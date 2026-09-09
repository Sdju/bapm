## 1. Lockfile merge and partition primitives

- [ ] 1.1 Add personal lock constants (`bapm.local.lock.yaml`), refuse `apm.local.lock.yaml`, and nullable discover/load helpers beside shared dual-read
- [ ] 1.2 Implement `mergeLockDocuments` (union by identity/`name`, fail closed on conflict) and personal-scope classification helpers
- [ ] 1.3 Implement partition write (shared deps + inventory bags → shared lock; personal deps → personal lock; clear stale personal entries; no create when personal empty)
- [ ] 1.4 Unit tests: merge union/conflict, partition round-trip, refuse apm personal brand, shared+personal not dual-conflict

## 2. Resolver provenance and dual-write

- [ ] 2.1 Stamp resolve nodes / lock entries originating from discriminator `local` as personal-scope (durable marker); leave OpenAPM `path:` shared-scope
- [ ] 2.2 Wire `resolveAndLock` to merge-load legacy shared locks, partition-write both files, and migrate personal-scope rows out of shared on success
- [ ] 2.3 Extend local-source gitignore ensure to cover `bapm.local.lock.yaml` when personal lock is written
- [ ] 2.4 Core tests: `local` → personal file; `path:` → shared only; mixed graph dual-write; legacy migrate on next lock

## 3. Install / lifecycle / lock consumers

- [ ] 3.1 Switch install / update / uninstall / prune lock read-write paths to merge-load + partition-write (preserve shared inventory carry-forward)
- [ ] 3.2 Switch deps / why / view / audit / find / frozen paths that need the full graph to effective merge-load
- [ ] 3.3 Confirm bare `bapm lock` inherits dual-write via core (CLI smoke or existing lock-command coverage)

## 4. Doctor, pack, publish

- [ ] 4.1 Doctor non-critical warning when `bapm.local.lock.yaml` is git-tracked (mirror overlay)
- [ ] 4.2 Pack archive omits `bapm.local.lock.yaml`
- [ ] 4.3 Publish archive omits `bapm.local.lock.yaml`

## 5. Docs and verify

- [ ] 5.1 Document shared vs personal lock in lockfile guide; cross-link local-source / overlay; commit/CI guidance (gitignore personal lock)
- [ ] 5.2 Run targeted core/cli tests for touched areas; `vp check` on changed packages as needed
