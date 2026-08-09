# Поддерживаемые hosts и кастомные интеграции

Куда `bapm install` / `bapm compile` раскладывают пакеты. Выбор id: [Как выбирается host](/guide/host-selection). Поля: [Hosts](/guide/manifest-hosts).

CLI **не** включает hosts «из коробки». Для известных id стандартный пакет — `@bapm/integration-<id>` (canonical fallback). Object-map `targets:` — override или custom host, не обязательный шаг для Cursor.

## Таблица

| Host             | Auto-detect                         | Canonical package                 | Explicit-only? | Override |
| ---------------- | ----------------------------------- | --------------------------------- | -------------- | -------- |
| **Cursor**       | `.cursor/` или `.cursorrules`       | `@bapm/integration-cursor`        | нет            | `targets:` ниже |
| **OpenCode**     | `.opencode/` / `opencode.json(c)`   | `@bapm/integration-opencode`      | нет            | `targets:` ниже |
| **Copilot**      | whitelist под `.github/`            | `@bapm/integration-copilot`       | нет            | `targets:` ниже |
| **Windsurf**     | `.windsurf/`                        | `@bapm/integration-windsurf`      | нет            | `targets:` ниже |
| **Kiro**         | `.kiro/`                            | `@bapm/integration-kiro`          | нет            | `targets:` ниже |
| **Grok Build**   | `.grok/`                            | `@bapm/integration-grok-build`    | нет            | `targets:` ниже |
| **Claude**       | `.claude/` или `CLAUDE.md`          | `@bapm/integration-claude`        | нет            | `targets:` ниже |
| **Codex**        | `.codex/`                           | `@bapm/integration-codex`         | нет            | `targets:` ниже |
| **Gemini**       | `.gemini/` или `GEMINI.md`          | `@bapm/integration-gemini`        | нет            | `targets:` ниже |
| **Antigravity**  | нет                                 | `@bapm/integration-antigravity`   | да (`--target` / `active`) | `targets:` ниже |
| **Agent Skills** | нет                                 | `@bapm/integration-agent-skills`  | да             | `targets:` ниже |
| **Свой агент**   | по вашей `detect`                   | —                                 | map обязателен | см. Advanced |

Пакет нужно **установить** (project `npm i -D` или global рядом с CLI). Absent map ≠ «нет hosts»: CLI пробует canonical для известных id.

## Happy path (Cursor)

```bash
npm i -D @bapm/integration-cursor
# есть .cursor/ →
bapm install
```

Без `targets:` в манифесте. Pin через `active` или `--target cursor` — по желанию.

### Cursor: layout

Skills → `.agents/skills/`, rules → `.cursor/rules/`, agents → `.cursor/agents/`, commands/hooks → `.cursor/…`, MCP → `.cursor/mcp.json`.

## Другие canonical hosts

Паттерн тот же: установить `@bapm/integration-<id>`, обеспечить detect **или** `active` / `--target`.

| Host     | Кратко про layout / notes                                      |
| -------- | -------------------------------------------------------------- |
| OpenCode | skills/agents/commands под `.opencode/`; MCP → `opencode.json` |
| Copilot  | `.github/instructions`, prompts, agents; MCP в home Copilot    |
| Windsurf | `.windsurf/rules`, workflows; MCP в Codeium home               |
| Claude   | `.claude/skills` (не `.agents`); marketplace через `bapm pack` |
| Codex    | `.agents/skills` + `.codex/`; compile → `AGENTS.md`            |

## Open-world и security

- **Open-world:** любой npm/path модуль с контрактом `createIntegration` может стать host через `targets:` — CLI не закрытый allowlist runtime.
- **Canonical list** — только удобный default specifier для известных id, не sandbox.
- Пакет интеграции = **trusted executable dependency** (как любая npm dep): bapm не изолирует код интеграции. Это отдельно от MCP trust, policy approve/deny, `--frozen` и file hashes.

## Advanced: custom `targets:`

Кастомный npm или локальный модуль:

```yaml
targets:
  x-acme-editor: "@acme/my-integration"
  # или override:
  cursor: "./agents/integration/my-cursor"
active:
  - x-acme-editor
```

```bash
bapm install --target x-acme-editor
```

### Контракт модуля

Экспорт (первое совпадение): `createIntegration()` → factory вроде `createCursorIntegration` → default. У экземпляра: `id` (совпадает с ключом map), `deployRoots`, `detect`, `materialize`. Helpers: `@bapm/integration-api`. Authoring: [Architecture](/architecture/).

Локальный path обязан оставаться внутри project root (containment).

## Типичные ошибки

| Симптом                                    | Что проверить                                                    |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `Unknown or unregistered target`           | Пакет установлен? Custom id объявлен в `targets:`?               |
| маркер есть, пакет не найден               | `npm i -D @bapm/integration-<id>`                                |
| `Target detection is missing or ambiguous` | `--target` / `active` / один маркер                              |

Дальше: [host selection](/guide/host-selection) · [быстрый старт](/guide/quick-start).
