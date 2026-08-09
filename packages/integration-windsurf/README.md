# @bapm/integration-windsurf

Windsurf/Cascade **runtime** host for bapm (project-scope file primitives + home MCP bake).

## Opt-in load

```bash
npm i -D @bapm/integration-windsurf
```

```yaml
targets:
  windsurf: "@bapm/integration-windsurf"
active:
  - windsurf
```

```bash
bapm install --target windsurf
```

## Detection vs forced target

| Mode                             | When active                        | Creates roots?                                      |
| -------------------------------- | ---------------------------------- | --------------------------------------------------- |
| **Auto-detect**                  | Project has `.windsurf/` directory | Only when materialize / configure runs after detect |
| **Forced** (`--target windsurf`) | Explicit forced target id          | MAY `mkdir` `.windsurf/` / `.agents/` as needed     |

Auto-detect without `.windsurf/` MUST NOT create roots solely for detection.

## Deploy roots

- `.windsurf` — rules, workflows, hooks merge + ownership sidecar
- `.agents` — portable skills under `.agents/skills/<name>/`

Home MCP (`~/.codeium/windsurf/mcp_config.json`, override with `CODEIUM_HOME`) is outside project deploy roots.

## Materialize routing

| Primitive   | Destination                                      |
| ----------- | ------------------------------------------------ |
| instruction | `.windsurf/rules/<name>.md`                      |
| command     | `.windsurf/workflows/<name>.md`                  |
| skill       | `.agents/skills/<name>/SKILL.md`                 |
| hook        | merge `.windsurf/hooks.json` (+ scripts/sidecar) |
| agent       | skipped (`WINDSURF_AGENTS_UNSUPPORTED`)          |

## Out of scope

User-scope deploy under `~/.codeium/windsurf/` (including `memories/global_rules.md`), agents trees, and compile emitters.
