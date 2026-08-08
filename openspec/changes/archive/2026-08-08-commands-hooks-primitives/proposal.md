## Why

OpenAPM and microsoft/apm treat **commands** and **hooks** as first-class primitives (discovery from `.apm/prompts` / `.apm/hooks` + top-level `hooks/`, Cursor/OpenCode deploy, plugin-collection path mapping). bapm today discovers only skills/agents/instructions, silently skips commands/hooks in Cursor and OpenCode materialize, and marks Agent Plugins hooks/commands as **not-supported**. Consumers who install APM-shaped packages lose slash-commands and harness hooks without a clear signal — blocking OpenAPM parity for two of the seven primitive types.

## What Changes

- **Discovery:** Recognize `command` primitives from `.apm/prompts/*.prompt.md` (and package-root `*.prompt.md` for APM backward compat) and `hook` primitives from `.apm/hooks/*.json` and/or top-level `hooks/*.json` (including hook-only packages). Apply existing attribution and conflict rules (local wins, first-declared dep wins).
- **Cursor materialize:** Deploy commands → `.cursor/commands/<name>.md` (Claude-format subset transform); merge hooks → `.cursor/hooks.json` with ownership tracking and script path rewrite under registered roots (APM-parity).
- **OpenCode materialize (host boundary):** Deploy commands → `.opencode/commands/<name>.md`; **hooks remain skipped** with an explicit, inspectable skip (APM matrix: opencode hooks not supported) — no silent ignore of discovered hooks without a diagnostic.
- **Agent Plugins (where appropriate):** When `plugin.json` declares `commands` / `hooks` paths, discover and materialize them through the same primitive pipeline; missing or escaping declared paths **fail closed** before deploy/lock commit. Update the compatibility matrix: hooks/commands leave `not-supported` for the declared-path surface.
- **Install / inventory:** Commands and hooks participate in conflict-resolved materialize and lock `deployed_files` / hashes like other primitives; orphan cleanup continues to use inventory.
- **Non-goals:** Copilot/Claude/Gemini/etc. additional hosts; full OpenAPM `prompts` deploy as a separate Copilot surface; promoting hooks/bin/canvas to full executable deny gates (CONFORMANCE soft / MCP-only honesty stays); inventing OpenCode hooks support beyond APM; silent “supported” claims for undeclared Agent Plugins agents/client-extensions/OAuth/sandbox.

## Capabilities

### New Capabilities

- `commands-hooks-primitives`: Cross-cutting contract for command/hook primitive types — source layouts, naming, shared prompt→command source rule, hook JSON discovery, conflict participation, and install-time expectations shared by discovery and hosts.

### Modified Capabilities

- `primitives-discovery`: Extend the discovery floor beyond skills/agents/instructions to include commands (from prompts) and hooks.
- `integration-cursor-runtime`: Stop skipping commands/hooks; materialize slash-commands and merge hooks under Cursor registered roots.
- `integration-opencode-runtime`: Materialize commands under `.opencode/commands/`; keep hooks out of OpenCode deploy with explicit skip semantics.
- `agent-plugins-compatibility`: Support declared `commands`/`hooks` in portable `plugin.json` (fail closed on bad paths); update matrix and docs so hooks/commands are no longer blanket not-supported.

## Impact

- **`@bapm/core`:** `Primitives/discover` (+ conflict resolution already generic); Agent Plugins load/mapping for declared commands/hooks; install materialize already type-agnostic once hosts handle types; docs/CONFORMANCE honesty unchanged for executable gates.
- **`@bapm/integration-cursor`:** Command transform + write; hooks merge/ownership/scripts under `.cursor/`.
- **`@bapm/integration-opencode`:** Command materialize; hooks skip + diagnostic.
- **Agent Plugins matrix / docs:** `AGENT_PLUGINS_COMPATIBILITY.md`, `compatibility-cases.json`, VitePress agent-plugins guide.
- **Tests:** Discovery, Cursor/OpenCode e2e materialize, Agent Plugins declared-path fail-closed + happy path; acceptance suite in later orch phases.
