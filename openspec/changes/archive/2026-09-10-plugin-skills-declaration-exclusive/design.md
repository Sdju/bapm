## Context

See `proposal.md` — Why. Today `validateAgentPluginManifest` allowlists top-level fields **without** `skills`, so a present key becomes `AGENT_PLUGIN_UNKNOWN_FIELD` and is dropped. `discoverAgentPluginSkills` always scans immediate `skills/<name>/SKILL.md`. Commands/hooks already use exclusive declared-path lists via `discoverAgentPluginDeclaredPaths` (fail-closed). Consumer dep `skills:` subset (`deps-object-subset`) is a different layer: empty list is a **parse error** there; plugin exclusive empty list means **zero deploy**.

## Goals / Non-Goals

**Goals:**

- First-class `skills?: string[]` on portable `AgentPluginManifest`.
- Three-way semantics in discover → install primitives: omit / `[]` / list.
- Fail-closed declared resolution aligned with commands/hooks tone.
- Docs + BREAKING changelog note; keep consumer subset composition order clear.

**Non-Goals:**

- Claude marketplace plugin collection without `$schema` as a separate package type.
- Copilot native registration; pack check-versions; CLI `--skill`.
- Changing deps-object-subset empty-list grammar.

## Decisions

### D1: Parse `skills` on Agent Plugins load (stop unknown-field)

- **Choice:** Add `skills` to `TOP_LEVEL_FIELDS`; validate as `string[]` when present (including empty); retain on `AgentPluginManifest.skills`. Malformed shapes throw `AGENT_PLUGIN_MANIFEST_INVALID` like `commands`/`hooks`.
- **Why:** Exclusive semantics require a retained declaration; ignoring the key makes omit-vs-`[]` impossible.
- **Alternatives:** Keep warning-and-ignore — rejected (no APM 0.29 parity). Only warn without retaining — rejected (install cannot honor exclusive).

### D2: Exclusive resolution lives in discover, not a second Install filter

- **Choice:** Extend `discoverAgentPluginSkills` (or a thin helper it calls) so returned `skills[]` already reflects exclusive semantics. Install keeps calling discover for portable roots; consumer `skillSubset` continues to filter **after** discover.
- **Why:** Single source of truth for “what skills does this plugin expose?”; matches how undeclared scan works today.
- **Alternatives:** Discover-all then Install filter by manifest — rejected (easy to miss other discover callers; pack/consumer tests call discover directly).

### D3: Declaration entry forms (names + conventional paths/containers)

- **Choice:** Accept (after trim): bare skill names (`hello`); relative paths under the plugin root that normalize to `skills/<name>` or `./skills/<name>`; conventional container `skills` / `./skills` expanding to immediate children with `SKILL.md`. Reject `..`, absolute paths, empty strings, and names that do not resolve. Do **not** require supporting arbitrary out-of-`skills/` skill roots in this slice unless already present as a valid contained skill directory with `SKILL.md` at expected depth relative to a declared path that stays inside the plugin root — prefer conventional `skills/` layout for portable plugins.
- **Why:** Matches APM “authoritative list / container at expected depth” without inventing deep recursive skill trees (current discover already refuses nested-only skills).
- **Alternatives:** Names-only — weaker vs APM path examples. Full recursive tree from any declared dir — rejected (breaks expected-depth rule).

### D4: Empty list diagnostic (shadow), not hard error

- **Choice:** `"skills": []` succeeds with zero skills; if conventional scan would have found ≥1 skill, emit one warning diagnostic (code TBD, e.g. `AGENT_PLUGIN_SKILLS_EMPTY_SHADOWS`) naming package/root and remediation (declare or omit key). Missing declared entries remain hard errors.
- **Why:** APM 0.29 documents intentional empty deploy + migration diagnostic; fail-closed is for bad declarations, not empty intent.
- **Alternatives:** Treat `[]` as parse error like dep subset — rejected (wrong layer; breaks APM exclusive empty meaning).

### D5: Fail-closed error code reuse pattern

- **Choice:** Use `AgentPluginsError` with a dedicated code (e.g. `AGENT_PLUGIN_SKILL_DECLARED_INVALID`) analogous to `AGENT_PLUGIN_DECLARED_PATH_INVALID`; Install surfaces it as install failure before lock commit (same timing as bad commands/hooks).
- **Why:** Existing declared-path pattern is proven in commands-hooks slice.
- **Alternatives:** Soft-skip unknown declared names — rejected (user criterion: fail-closed).

## Risks / Trade-offs

- [Plugins that accidentally shipped `"skills": []` or a placeholder list] → Mitigation: BREAKING docs/changelog; empty shadow diagnostic; omit key restores discovery.
- [Confusion with consumer dep `skills: []` parse error] → Mitigation: docs callout; separate codes/messages; composition requirement in specs.
- [Agent Plugins JSON Schema upstream may omit `skills`] → Mitigation: bapm treats it as portable install contract extension aligned with APM plugin exclusive semantics; still require `$schema` v1 for this module; do not claim upstream schema certification.
- [Out-of-`skills/` declared paths] → Mitigation: keep slice conventional-depth focused; document; follow-ups can widen if marketplace Claude plugins land.

## Migration Plan

- Authors: omit `skills` for discovery; list every intended skill (or `skills` container) for exclusivity; use `[]` only when zero skills are intended.
- No lockfile schema bump required (deploy inventory simply shrinks when exclusive/empty applies).
- Rollback: revert discover/load changes; docs note temporary loss of exclusive control.

## Open Questions

None — omit / `[]` / list and fail-closed unknown declarations locked to parent criteria + APM package-types exclusive wording.
