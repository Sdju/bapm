## 1. Core consent API

- [ ] 1.1 Add `trustBin` consent mode on `RunInstallOptions` (`allow` | `deny` | `default`) plus injectable interactive/non-interactive signals (env / TTY / frozen) per design D1–D2
- [ ] 1.2 Implement pure effective bin-deploy decision helper that calls `resolveExecutableTrust` with `executableType: "bin"` then applies invocation overlay (deny-wins; flags cannot override deny)
- [ ] 1.3 Export the helper from `ExecutableTrust` or Install public API; unit-test the matrix (interactive default, CI/frozen default skip, `--trust-bin`, `--no-trust-bin`, org/project deny vs flag, project `bin: true` allow)

## 2. Bin discover + gated materialize

- [ ] 2.1 Discover package-root `bin/` files for dependency packages (safe path containment; no traversal outside package root)
- [ ] 2.2 Wire install to evaluate consent before writing bin files; skip + diagnostic on withhold; leave skills/other primitives unaffected
- [ ] 2.3 When consent allows, materialize bins into the thin documented deploy destination (design D3); cover allow vs skip in core install tests with a `bin/` fixture

## 3. CLI flags and help

- [ ] 3.1 Parse `--trust-bin` / `--no-trust-bin` in Install argv; mutual exclusion error; reject neither as unknown
- [ ] 3.2 Forward consent into `coreRunInstall` options
- [ ] 3.3 Update `formatInstallHelp` (and any top-level install help mirror) to document both flags and the non-interactive default
- [ ] 3.4 CLI tests: known flags, mutual exclusion, help mentions flags + non-interactive note

## 4. Soft honesty and docs

- [ ] 4.1 Update `CONFORMANCE.md` / Limitations so bin is gated (consent + ExecutableTrust); hooks/canvas remain soft
- [ ] 4.2 Fix limitations-honesty / sc-executable-governance soft wording tests for the new trio split
- [ ] 4.3 Short user-facing docs note (install guide or reference) for `--trust-bin` / `--no-trust-bin`

## 5. Verification

- [ ] 5.1 Run targeted vitest for consent helper, install bin gate, and CLI parse/help
- [ ] 5.2 Run `vp check` (or package-scoped check) and fix regressions introduced by this change
