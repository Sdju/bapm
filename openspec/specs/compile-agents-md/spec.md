# compile-agents-md Specification

## Purpose

Defines `bapm compile`: discover project and module primitives, select one or more registered compile-capable targets from an explicit `--target` list, `--all`, a sole manifest `active` id, or a sole positive auto-detect, and delegate instruction-file emission to each selected target. Every supported host is selected the same way; Cursor is one target, not the compile contract. The default remains one output per host. Opt-in `--distributed` adds a conservative per-directory `applyTo` placement subset with fail-closed path checks. Multi-target emission is in scope: `--target a,b` and `--all` write one output per host per placement directory in a single invocation, with fail-closed output-path collision handling.

## Requirements

### Requirement: Compile emits one target-owned instruction file per selected target

`bapm compile` MUST discover primitives from the project and installed modules, resolve primitive conflicts, order the surviving primitives deterministically, and delegate emission to each selected registered compile-capable target. In the default single-file mode each invocation MUST emit exactly one instruction file per selected target. In opt-in distributed mode it MUST emit one file per target per resolved placement directory. Compile MUST use only the selected targets' compile capabilities and MUST NOT require foreign-host adapters or packages beyond the selected set. When several targets are selected, compile MUST emit their files in one invocation.

#### Scenario: Selected target writes its instruction file

- **WHEN** the project has discoverable primitives and compile succeeds for a selected compile-capable target
- **THEN** that target's compile capability MUST render and write its instruction file and the command MUST exit `0`

#### Scenario: One invocation does not emit foreign host files

- **WHEN** compile succeeds for a single selected Claude target
- **THEN** `CLAUDE.md` MAY be written by that invocation and compile MUST NOT also create `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`, or another unselected target's instruction file

#### Scenario: Multi-target invocation writes every selected host file

- **WHEN** compile runs with `--target cursor,claude` and both hosts resolve distinct output paths
- **THEN** the invocation MUST write `AGENTS.md` and `CLAUDE.md`, report both outputs, and exit `0`

### Requirement: Compile selects explicit, multi, all, or unambiguous registered targets

Compile MUST obtain target detection and compile emission from the registered integration registry. Selection MUST prefer explicit forced targets when present. `--target <id>` selects one host; `--target <a>,<b>` selects a comma-separated list in order. `--all` MUST select every registered compile-capable integration at project scope. `--target` and `--all` MUST be mutually exclusive and MUST fail closed when combined. Else when the project manifest `active` lists exactly one registered compile-capable integration id, compile MUST select that id without requiring detect. Else without an explicit target, exactly one registered compile-capable integration MUST positively detect the project for compile to proceed. When `active` lists more than one id without an explicit `--target`, or when zero or multiple registered compile-capable integrations are detected and no sole `active` id applies, compile MUST fail with clear guidance to pass `--target <id>` and MUST not write a compile output. An explicit or automatic target MUST be accepted only when it exposes the compile capability. `--all` MUST skip registered targets without compile rather than failing on them.

#### Scenario: Compile automatically selects sole detected target

- **WHEN** `bapm compile` runs without `--target`, without a sole manifest `active` compile id, and exactly one registered compile-capable integration detects the project
- **THEN** compile MUST use that integration's emission capability and succeed according to normal write, validate, or dry-run semantics

#### Scenario: Compile rejects absent or ambiguous automatic selection

- **WHEN** `bapm compile` runs without `--target`, without a sole manifest `active` compile id, and zero or multiple registered compile-capable integrations detect the project
- **THEN** it MUST fail with guidance to pass `--target <id>` and MUST not create or modify compile output

#### Scenario: Sole active selects compile without detect

- **WHEN** `bapm compile` runs without `--target`, `active` contains exactly one registered compile-capable id, and detect is absent
- **THEN** compile MUST use that id's emission capability

#### Scenario: Multi active without target fails compile

- **WHEN** `bapm compile` runs without `--target` and `active` lists two or more ids
- **THEN** compile MUST fail with guidance to pass `--target <id>` and MUST not write compile output

#### Scenario: Forced unregistered or non-compile target fails

- **WHEN** compile runs with `--target <id>` for an id that is unregistered or does not expose compile
- **THEN** compile MUST fail without writing an output file

#### Scenario: Comma-separated target list selects several hosts

- **WHEN** compile runs with `--target cursor,claude`
- **THEN** both ids MUST be resolved from the registry and their compile capabilities used, in that order

#### Scenario: All selects every compile-capable target

- **WHEN** compile runs with `--all`
- **THEN** it MUST emit for every registered target that exposes compile and MUST ignore registered targets that do not

#### Scenario: Target and all conflict

- **WHEN** compile runs with both `--target` and `--all`
- **THEN** it MUST fail without writing any compile output

### Requirement: Compile output layout is owned by the selected target

The selected target's compile capability MUST determine the default output path and render the compile output from the conflict-resolved primitive set. Core MUST retain discovery, conflict resolution, option validation, and no-write orchestration, but MUST NOT derive a host-specific default path itself. Shipped compile-capable targets MUST default to:

- Cursor, Codex, OpenCode, Kiro, Grok Build, Hermes, and Antigravity: project-root `AGENTS.md`
- Claude: project-root `CLAUDE.md`
- Gemini: project-root `GEMINI.md`
- Copilot: `.github/copilot-instructions.md`

Windsurf does not expose compile and MUST be rejected as a compile target. Compile MUST NOT merge several hosts into one document. Cursor, Codex, OpenCode, Kiro, Grok Build, Hermes, and Antigravity share `AGENTS.md`; selecting more than one of them in a single invocation MUST fail closed instead of overwriting.

#### Scenario: Target controls default compile output

- **WHEN** compile succeeds for a selected target without an output override
- **THEN** the reported output path and content MUST be supplied by that target capability rather than a core default

#### Scenario: AGENTS family host writes project-root AGENTS.md

- **WHEN** compile selects Cursor, Codex, OpenCode, Kiro, Grok Build, Hermes, or Antigravity and no `-o` / `--output` is supplied
- **THEN** `AGENTS.md` at the project root MUST be the reported and written path

#### Scenario: Claude and Gemini use their own default names

- **WHEN** compile selects Claude or Gemini without an output override
- **THEN** Claude MUST default to `CLAUDE.md` and Gemini MUST default to `GEMINI.md`

#### Scenario: Copilot uses its instructions path

- **WHEN** compile selects Copilot without an output override
- **THEN** the default output MUST be `.github/copilot-instructions.md`

#### Scenario: Shared AGENTS.md is not merged across hosts

- **WHEN** compile selects two or more AGENTS-family hosts in one invocation
- **THEN** the invocation MUST fail closed before writing and MUST list the colliding hosts and path

#### Scenario: Windsurf cannot be a compile target

- **WHEN** compile runs with `--target windsurf`
- **THEN** compile MUST fail because the target does not expose the compile capability

### Requirement: Multi-target output collisions fail closed

Before durable write, compile MUST resolve the output path of every selected target. When two or more selected targets resolve to the same path, compile MUST fail with a diagnostic that lists every colliding host and the shared path, MUST NOT write any selected output, and MUST NOT silently let one host overwrite another. This policy applies to `--target a,b`, `--all`, and any programmatic multi-target selection, with or without `--dry-run` / `--validate`. Compile MUST reject `-o` / `--output` when more than one target is selected because one path cannot be shared across hosts. A multi-target selection where every path is distinct MUST proceed and write one file per host.

#### Scenario: Two AGENTS-family hosts collide

- **WHEN** compile runs with `--target cursor,codex`
- **THEN** exit code MUST be non-zero, the diagnostic MUST mention `cursor`, `codex`, and `AGENTS.md`, and `AGENTS.md` MUST NOT be created or rewritten

#### Scenario: All collides on the shared AGENTS.md

- **WHEN** `bapm compile --all` selects several AGENTS-family hosts
- **THEN** compile MUST fail closed, listing the colliding hosts and `AGENTS.md`, and MUST write no selected output

#### Scenario: Distinct multi-target paths all write

- **WHEN** compile runs with `--target claude,gemini,copilot`
- **THEN** `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md` MUST all be written and exit code MUST be `0`

#### Scenario: Output override with multiple targets is rejected

- **WHEN** compile runs with `--target cursor,claude -o OUT.md`
- **THEN** compile MUST fail without writing `OUT.md` or any host file

### Requirement: Compile accepts output path flag

`bapm compile` MUST accept `-o` / `--output PATH` and MUST write the compiled instruction file to that path relative to the project cwd when neither `--validate` nor `--dry-run` applies. `-o` / `--output` MUST be valid only when exactly one target is selected; with multiple targets compile MUST reject it. When `-o` / `--output` is omitted, the default output MUST be the selected target's default path. Parent directories for the output path MUST be created when missing. Paths outside cwd are invalid. A target MAY require a fixed basename: shipped Codex, OpenCode, Grok Build, and Hermes targets require `AGENTS.md`, and Gemini requires `GEMINI.md`.

#### Scenario: Custom output path writes only that file

- **WHEN** `bapm compile -o nested/OUT.md` runs successfully in a project with discoverable primitives
- **THEN** exit code MUST be `0`, `nested/OUT.md` MUST exist with compiled content, and the target's default output MUST NOT be created by that run

#### Scenario: Default output is target-owned

- **WHEN** `bapm compile` runs successfully for a selected target without `-o` / `--output`
- **THEN** the selected target's default path MUST be written at the project root or target-relative path documented for that host

#### Scenario: Target-enforced basename rejects another name

- **WHEN** compile runs for Codex, OpenCode, Grok Build, or Hermes with an output basename other than `AGENTS.md`, or for Gemini with a basename other than `GEMINI.md`
- **THEN** compile MUST fail without writing the output file

#### Scenario: Output outside cwd is rejected

- **WHEN** compile is given `-o ../OUT.md` or another cwd-escaping path
- **THEN** compile MUST fail without writing outside the project cwd

### Requirement: Deterministic Build ID when inputs unchanged

The compile emitter MUST order discovered primitives deterministically. Every compiled Markdown output MUST end with exactly one canonical line `<!-- Build ID: <12 hex> -->` (or contain an equivalent APM-compatible build-id section). The id MUST be a truncated SHA-256 of the normalized content with every Build ID line excluded (line endings, BOM, and trailing line whitespace normalized). When inputs (discovered primitive set and compile options) are unchanged and no volatile fields are included, two consecutive compiles MUST produce byte-identical instruction-file content with the same Build ID. Changed content MUST produce a changed Build ID. The Build ID detects drift; it is not a provenance or security attestation.

#### Scenario: Stable body and Build ID across two compiles

- **WHEN** `bapm compile` runs twice without changing discovered inputs
- **THEN** the emitted instruction-file content MUST be byte-identical and the Build ID line MUST be identical

#### Scenario: Changed content changes the Build ID

- **WHEN** a discovered primitive body changes between two compiles
- **THEN** the Build ID line MUST change

#### Scenario: Hand-authored content has no Build ID

- **WHEN** a Markdown file is written by hand rather than by compile
- **THEN** it MUST NOT be treated as having a valid Build ID

### Requirement: Validate mode does not write

When `--validate` is provided, compile MUST perform discovery and validation checks without durable write of any compile output file (each selected target's default or the path from `-o` / `--output`). Validate success messaging MUST remain distinct from `--dry-run` would-write preview messaging.

#### Scenario: Validate leaves the default output untouched

- **WHEN** `bapm compile --validate` runs and the selected target's default output is absent or previously unchanged
- **THEN** compile MUST NOT create or rewrite that output as a durable result

#### Scenario: Validate with custom output does not write that path

- **WHEN** `bapm compile --validate -o nested/OUT.md` runs and `nested/OUT.md` is absent
- **THEN** `nested/OUT.md` MUST remain absent

### Requirement: Dry-run previews without write

When `--dry-run` is provided (and `--validate` is not), compile MUST discover and render as for a normal compile, MUST print a would-write preview that includes every intended output path (one line per selected target when multi-target) and primitives count, MUST NOT create or rewrite any output file (the selected targets' defaults or the single `-o` path), and MUST exit `0` on success. The dry-run success message MUST be observably distinct from the `--validate` success message.

#### Scenario: Dry-run leaves output absent

- **WHEN** `bapm compile --dry-run` runs and the output file is absent
- **THEN** exit code MUST be `0`, stdout MUST mention the would-write path and a primitives count, and the output file MUST still be absent

#### Scenario: Dry-run does not rewrite existing output

- **WHEN** an output file already exists and `bapm compile --dry-run` runs
- **THEN** the output file content MUST be unchanged

### Requirement: Validate-first when combined with dry-run

When both `--validate` and `--dry-run` are set, compile MUST follow validate-first semantics (APM early-return): perform discovery/validation only, MUST NOT write, MUST NOT use dry-run would-write messaging as the primary success message, and MUST exit `0` on success with a validate-style message.

#### Scenario: Both flags prefer validate messaging and no write

- **WHEN** `bapm compile --validate --dry-run` runs and the output file is absent
- **THEN** exit code MUST be `0`, the output file MUST remain absent, and stdout MUST match validate-style messaging (not dry-run would-write as the sole/primary success line)

### Requirement: Clean removes only orphaned generated outputs with a valid Build ID

`bapm compile --clean` (and the core `clean` option) MUST remove orphaned generated compile outputs for the selected hosts: files matching a selected target's output shape (basename and host directory prefix) that are absent from the current invocation's planned output set. Deleting a file MUST require exactly one canonical Build ID line whose id matches the normalized content. Compile MUST NEVER delete a hand-authored file without a Build ID, or a generated file whose Build ID no longer matches its content (edited after compile). Current planned outputs MUST NOT be deleted by the clean phase. `--dry-run` MUST list every would-remove path and MUST NOT delete or write any file. `--validate` MUST suppress cleaning. `--clean` MUST use the same target selection as compile; an explicit `--target` is not required when a sole manifest `active`, config target, or sole auto-detect applies. Multi-target selection MUST consider every selected host's output shape; distributed mode MUST also find stale nested placements. `--watch` is separate from clean and MUST NOT suppress it.

#### Scenario: Clean removes a stale generated output

- **WHEN** `compile --clean` finds a target-shaped generated file that is not in the current plan and whose Build ID matches its content
- **THEN** it MUST delete that file and report the removal

#### Scenario: Clean never deletes a hand-authored file

- **WHEN** a target-shaped file exists without a Build ID
- **THEN** `compile --clean` MUST leave it untouched

#### Scenario: Clean never deletes an edited generated file

- **WHEN** a generated file's content was edited after compile so its Build ID no longer matches
- **THEN** `compile --clean` MUST keep it and MUST NOT delete it

#### Scenario: Clean dry-run lists removals

- **WHEN** `compile --clean --dry-run` finds a stale generated output
- **THEN** it MUST print `would remove <path>` (or equivalent), MUST NOT delete the file, and MUST NOT write the current output

#### Scenario: Clean validate performs no deletion

- **WHEN** `compile --clean --validate` runs
- **THEN** no generated output MAY be deleted

#### Scenario: Clean respects multi-target and distributed shapes

- **WHEN** `compile --target a,b --clean` or `compile --distributed --clean` runs
- **THEN** orphan candidates MUST be limited to the selected hosts' output shapes, including stale nested distributed placements

### Requirement: Watch recompiles when relevant inputs change

`bapm compile --watch` (`-w`) MUST perform one initial compile with the same target selection, write, distributed, clean, and dry-run semantics as a normal invocation, then keep running and recompile when relevant project inputs change. Watched inputs MUST include the root manifest (`bapm.yml` / `apm.yml` and the local overlay), `.apm/`, `apm_modules/`, package-root `SKILL.md` / `skills/` / `hooks/` / `*.prompt.md`, and directories of local manifest dependencies. Filesystem events MUST be debounced (approximately 200 ms) and compile runs MUST NOT overlap; an event during an active run MUST queue at most one follow-up run. When the manifest changes the watched local directory set, it MUST be re-resolved. A compile error MUST be reported and MUST NOT stop the watcher, and `--watch` MUST NOT add network access beyond the normal compile. `--watch` MUST be rejected when combined with `--validate`. On SIGINT or SIGTERM the watcher MUST close and the command MUST exit `0`. A watch factory (or equivalent injection) and a single-run mode MUST be available so tests can drive the loop without real filesystem watchers.

#### Scenario: Watch performs an initial compile

- **WHEN** `bapm compile --watch` starts in a project with discoverable primitives
- **THEN** it MUST write the selected target output once before waiting for changes

#### Scenario: Watch recompiles on a relevant input change

- **WHEN** a watched instruction primitive under `.apm/` changes while `compile --watch` runs
- **THEN** the command MUST recompile after the debounce window and update the target output

#### Scenario: Debounce coalesces a burst of events

- **WHEN** several filesystem events arrive within the debounce window
- **THEN** compile MUST run once for that burst rather than once per event

#### Scenario: Transient compile error keeps watching

- **WHEN** a watched-input compile fails and the watcher is running
- **THEN** the command MUST print the error, MUST keep watching, and a later change MUST trigger another compile attempt

#### Scenario: Watch and validate are incompatible

- **WHEN** compile runs with both `--watch` and `--validate`
- **THEN** it MUST fail with a clear diagnostic and MUST NOT start a watcher or write output

#### Scenario: Signal stops the watcher with exit 0

- **WHEN** `compile --watch` receives SIGINT or SIGTERM
- **THEN** it MUST close the watcher, stop cleanly, and exit `0`

#### Scenario: Watcher is injectable

- **WHEN** tests run the watch loop with an injected watch factory or single-run mode
- **THEN** the loop MUST use that factory (or return after the initial compile) without requiring a real filesystem watcher

### Requirement: Verbose emits thin source attribution

When `-v` / `--verbose` is provided on a successful compile or dry-run path, the CLI MUST emit thin source attribution for discovered primitives including at least each primitive's name and type, and path when known. Verbose output MUST NOT claim multi-host optimizer analysis or distributed placement.

#### Scenario: Verbose lists name type and path

- **WHEN** `bapm compile -v` (or `--verbose`) succeeds against a fixture with at least one discoverable primitive that has a known path
- **THEN** stdout MUST include that primitive's name, type, and path (or an equivalent thin attribution line covering those fields)

### Requirement: Core compile options support target selection, dry-run, and verbose

`@b-apm/core` compile orchestration MUST accept options equivalent to `forcedTarget`, `forcedTargets` (multi-target list), `all`, an integration registry (or registered target factory), `dryRun`, and `verbose` (in addition to existing `validate` and `outputFile`) so target selection and no-write preview are not CLI-only side effects. When `dryRun` is true and `validate` is false, core MUST compute content and MUST set `wrote` false without durable write. When `validate` is true, core MUST NOT write regardless of `dryRun`. The result MUST expose one `outputs` entry per selected target with `targetId`, `path`, and `wrote`, while retaining the single-target `path` / `content` / `wrote` fields for compatibility.

#### Scenario: Core dryRun does not write

- **WHEN** core compile is invoked with `dryRun: true` and `validate: false`
- **THEN** the result MUST report `wrote: false` and every output path on disk MUST not be created or rewritten by that call

#### Scenario: Core forced target bypasses detection

- **WHEN** core compile is invoked with a registered `forcedTarget`
- **THEN** it MUST use that target's compile capability without consulting manifest `active` or auto-detect

#### Scenario: Core forcedTargets emits one output per host

- **WHEN** core compile is invoked with `forcedTargets: ["cursor", "claude"]`
- **THEN** `outputs` MUST contain one entry per target in order, and the first entry MUST also populate the legacy `path` field

#### Scenario: Core all selects all compile-capable targets

- **WHEN** core compile is invoked with `all: true`
- **THEN** `outputs` MUST include every registered target that exposes compile and MUST exclude registered hosts without compile

### Requirement: Compile does not replace install materialize

Compile MUST NOT be required to refresh host install materialize trees such as rules, skills, agents, commands, or hooks; those remain install's responsibility. Compile's deliverable is one instruction file per selected target in single-file mode, or one per placement directory in distributed mode.

#### Scenario: Compile does not write host materialize trees

- **WHEN** `bapm compile` runs without a prior install materialize of rules
- **THEN** compile MUST NOT create or update a host rules tree such as `.cursor/rules/`, `.claude/rules/`, or `.kiro/steering/`

### Requirement: Distributed placement is opt-in and the single-file default is unchanged

Without `--distributed` (or `--strategy distributed`), compile MUST emit exactly one instruction file per selected target and MUST NOT create per-directory outputs. `--strategy single-file` MUST select the same default behavior. An unknown `--strategy` value MUST fail closed without writing. Distributed mode MUST reject `-o` / `--output` because each placement directory owns its own output path. Multi-target collision policy MUST cover every distributed emission path, not only each target's root file.

#### Scenario: Default compile ignores applyTo placement

- **WHEN** a discovered instruction primitive declares `applyTo` and compile runs without `--distributed`
- **THEN** compile MUST write exactly that target's single default output and MUST NOT create per-pattern or per-directory compile outputs

#### Scenario: Strategy flag selects the mode

- **WHEN** compile runs with `--strategy distributed`
- **THEN** it MUST behave as `--distributed`, and `--strategy single-file` MUST restore the single-file default

#### Scenario: Distributed rejects output override

- **WHEN** compile runs with `--distributed -o OUT.md`
- **THEN** it MUST fail without writing `OUT.md` or any host output

### Requirement: Distributed compile reads applyTo and places by literal directory prefix

In distributed mode compile MUST read instruction frontmatter `applyTo` in scalar, top-level comma-separated, or YAML-list form, and MAY accept `globs` as an alias. Compile MUST use the literal directory prefix before the first glob segment as the placement directory: `src/**`, `src/**/*.ts`, and `src/foo.ts` place under `src/`; `docs/*.md` places under `docs/`; root-only patterns such as `**/*.ts`, `*.ts`, `{src,lib}/**`, and bare names without `/` place at the project root. Missing, unreadable, or malformed frontmatter MUST be treated as global. Multiple patterns MUST place the instruction in every distinct resolved directory. Each placement MUST use the selected target's own default basename and prefix (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`), changing only the directory. This is a conservative subset: file-match scoring, inheritance analysis, and other APM context-optimizer behavior are NOT required.

#### Scenario: Single applyTo glob writes a child-directory output

- **WHEN** an instruction declares `applyTo: "src/**"` and compile runs with `--distributed`
- **THEN** the selected target's host output MUST be written under `src/` (for example `src/AGENTS.md` for Cursor) and the instruction body MUST appear in it

#### Scenario: Multiple globs place the same instruction in every directory

- **WHEN** an instruction declares multiple `applyTo` patterns resolving to `src` and `docs`
- **THEN** compile MUST write both `src/<host-file>` and `docs/<host-file>` with that instruction

#### Scenario: Host-specific names are preserved

- **WHEN** a Claude target compiles an instruction with `applyTo: "src/**"` in distributed mode
- **THEN** the output MUST be `src/CLAUDE.md`, and Copilot MUST use its `.github/<dir>/copilot-instructions.md` shape

### Requirement: Distributed root output retains global and non-instruction primitives

Instructions without `applyTo`, instructions whose patterns resolve to the project root, and every non-instruction primitive MUST remain in the root output. Instructions placed only in child directories MUST NOT be duplicated into the root output. When every instruction is distributed below the root and no non-instruction or global primitive remains, compile MUST suppress the empty root output shell.

#### Scenario: Global and distributed instructions are separated

- **WHEN** one instruction has no `applyTo` and another declares `applyTo: "src/**"` in distributed mode
- **THEN** the root host file MUST contain the global instruction, `src/<host-file>` MUST contain the distributed instruction, and neither MUST contain the other's body

#### Scenario: Empty root shell is suppressed

- **WHEN** every discovered instruction is distributed below the root and no root-only primitives exist
- **THEN** compile MUST NOT create a root host file containing only an empty placeholder

### Requirement: Distributed paths fail closed

Distributed output paths MUST remain inside the project cwd. Compile MUST reject absolute patterns, `..` segments, control directories (`.git`, `node_modules`, `apm_modules`, `bapm_modules`), and any existing symlink component in the output path. These checks MUST run before any durable write and MUST apply equally to `--dry-run` and `--validate`. A rejected path MUST produce a non-zero error and MUST NOT write any selected output.

#### Scenario: Escaping applyTo is rejected

- **WHEN** an instruction declares `applyTo: "../outside/**"` in distributed mode
- **THEN** compile MUST fail with a path-escape diagnostic and MUST NOT write outside the project

#### Scenario: Symlinked placement directory is rejected

- **WHEN** the resolved placement directory is a symlink
- **THEN** compile MUST fail before writing and MUST NOT create or modify any output

#### Scenario: Validate and dry-run perform the same safety check

- **WHEN** compile runs in distributed mode with `--validate` or `--dry-run` against an unsafe path
- **THEN** it MUST fail closed without writing

## Tech debt (APM parity — not claimed)

The default per-host single-file compile is **intentional**. Multi-target `--target a,b` / `--all` is supported, and opt-in `--distributed` places instructions by the literal `applyTo` directory prefix. Full APM `AgentsCompiler` context-optimizer parity remains product tech debt (not silent omissions, not OpenAPM MUST failures). Canonical IDs: `.samples/apm-knowledge/topics/tech-debt-compile.md`.

| ID            | Gap                                                                    | Status                                                         |
| ------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| TD-COMPILE-01 | Emit all primitives vs APM instructions-only                           | debt                                                           |
| TD-COMPILE-02 | Full APM context-optimizer placement (file-match scoring, inheritance) | debt (opt-in literal-prefix `--distributed` ships)             |
| TD-COMPILE-03 | No markdown link inline / `--no-links`                                 | debt (SHOULD deferred)                                         |
| TD-COMPILE-05 | Missing APM UX flags (`--global`, …); `--clean` and `--watch` ship     | debt (`--clean` and `--watch` implemented; `--global` remains) |
| TD-COMPILE-06 | Unicode write gate (deterministic Build ID ships)                      | debt (Build ID implemented; Unicode gate remains)              |
| TD-COMPILE-07 | Thinner `--validate` than APM                                          | debt                                                           |
| TD-COMPILE-08 | Flat `## name (type)` vs APM template sections                         | debt                                                           |

Closing a `debt` row REQUIRES a dedicated OpenSpec change that updates this section and the knowledge inventory. Specs MUST NOT claim APM AgentsCompiler parity while these rows remain open.
