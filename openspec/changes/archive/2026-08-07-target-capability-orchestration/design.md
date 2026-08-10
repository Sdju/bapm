## Context

See `proposal.md` for motivation and the delta specs for observable behavior. The registry currently lists targets and exposes per-target `detect`, materialization, and optional MCP configuration, but each caller re-evaluates detection and can activate every match. Core's compile module renders Cursor's `AGENTS.md` directly, while install has target iteration that can lose which target supplied an inventory entry. The CLI currently creates and registers Cursor separately for install, and compile does not receive a registry.

## Goals / Non-Goals

**Goals:**

- Make a single explicit target-selection policy reusable by compile, install materialization, and MCP configuration.
- Extend the generic target boundary so target packages own compile output and report deployment attribution.
- Move target registration to a composition-root factory usable by both CLI paths and test harnesses.
- Validate excludes against registrations without adding a host-specific catalog to core.

**Non-Goals:**

- Add another concrete target package or a multi-host `--target all` mode.
- Change manifest target-intersection semantics for package primitives after a target is selected.
- Make detection errors fatal by themselves; they remain non-matches with diagnostics unless selection cannot be resolved.
- Change dry-run/validate ownership: orchestration remains responsible for preventing durable writes.

## Decisions

### Centralize registry detection and selection

`bapm-target-api` will gain a generic registry query that evaluates each registered target once for a cwd and returns detected ids plus non-sensitive diagnostics. Core will own a small target-selection service that consumes that result:

1. Explicit `forcedTarget` / CLI `--target` must name a registered target and is selected regardless of its detector.
2. Without an explicit id, exactly one detected target is selected.
3. Zero or multiple detections return a typed selection error with the detected ids and the `--target <id>` remedy.

The same selection result is passed to install materialization and MCP configuration so one invocation cannot materialize one detected set and configure a newly re-detected different set. Existing manifest target declarations continue as primitive-intersection constraints after selection; they do not silently override the explicit-or-unambiguous selection policy.

Alternative considered: retain per-call detection loops and merely reject `activeTargets.length !== 1`. Rejected because repeated detection can be inconsistent and allows materialize and MCP to disagree.

### Add optional target-owned compile capability

The target API will expose a compile capability with a generic context: cwd, conflict-resolved primitives, optional cwd-relative output override, and core-controlled write/validate intent. The target returns the effective project-relative path, rendered content, and whether it wrote. Cursor moves rendering and its `AGENTS.md` default into `bapm-target-cursor`.

Core continues primitive discovery, conflict resolution, deterministic input ordering, validation, and presentation-ready attribution. It selects a target before invoking the capability and rejects a selected target that lacks compile support. This preserves generic orchestration without hard-coding an `AGENTS.md` fallback.

Alternative considered: return a target-provided output descriptor and retain a shared core renderer. Rejected because renderer formatting and default destination are target layout knowledge.

### Attribute reports at the target boundary

Materialize and MCP reports will be normalized at the API boundary to retain `targetId` and the target-reported relative paths/hashes. Core will combine reports only after validating that the target id is registered and paths stay within the target's declared roots. Lockfile inventory association uses the target report plus the primitives/MCP inputs passed to that invocation; core will not derive target paths or Cursor filenames.

Alternative considered: infer ownership later from path prefixes such as `.cursor/`. Rejected because it embeds a concrete host layout and fails for arbitrary targets.

### Register targets in one CLI composition root

The CLI will create its registry through a composition-root helper that registers each target package shipped by the CLI. Both `compile` and `install` receive that registry. `@b-apm/core` continues accepting injected registries and imports only `bapm-target-api`; unit tests register target doubles directly.

Alternative considered: make `target-api` auto-import known targets. Rejected because it reverses the dependency boundary and would force every consumer to ship every host package.

### Validate exclusions against the registry before target writes

After registry construction and CLI parsing, install validates every exclude id with the registry. This supports arbitrary registered targets and avoids a Cursor list. The selected target receives exclusion only for configuration capability decisions; package resolution and non-MCP materialization retain their existing behavior.

## Risks / Trade-offs

- [Existing projects rely on Cursor as an implicit compile default] → Require a Cursor detection signal or `compile --target cursor`; document the error and test both paths.
- [A target detector is stateful or expensive] → Evaluate once per invocation and carry the selection forward.
- [Changing report shapes can break target test doubles] → Provide narrow compatibility normalization only where it does not invent ownership; update public contract tests and all in-tree target doubles.
- [Manifest-declared targets conflict with selected target] → Keep them as post-selection primitive filters and emit a diagnostic when their intersection yields no deployable primitives.

## Migration Plan

1. Extend target-api contracts, registry tests, and the Cursor target implementation.
2. Add core selection/attribution tests and migrate compile/install orchestration to the new registry result.
3. Route CLI compile and install through the shared composition-root registry, adding `compile --target`.
4. Run target-api, target-cursor, core, and CLI test suites plus strict OpenSpec validation.

Rollback is a normal code revert of the implementation change; no persistent data migration is required. Existing lockfile entries remain readable because the change only changes how future reports are attributed.
