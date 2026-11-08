# Часть агентов пишет MCP только если каталог уже есть

**Статус:** намеренно (per-host) / сюрприз UX  
**Класс:** продукт  
**Важность:** средняя — на чистом репозитории MCP-only install молча не создаёт конфиг у четырёх популярных хостов; есть простой обход (`mkdir`/skills), но диагностика до пользователя не доходит.  
**Проверено:** 08-11-2026, working tree

## Суть

Cursor создаёт `.cursor/` при необходимости и пишет `.cursor/mcp.json`. Claude, Gemini, Kiro и Antigravity устроены иначе: `configureMcp` проверяет каталог агента и при его отсутствии возвращает пустой `servers` + diagnostic, не создавая каталог. Это зафиксировано в спеках как opt-in: Claude требует существующий `.claude/`, Gemini — `.gemini/`, Kiro — `.kiro/`, Antigravity — `.agents/`.

Срабатывает это в обычном сценарии `bapm install --only mcp` или при установке одних MCP-серверов: materialize не вызывается либо не создаёт каталог, а configureMcp уже не имеет права его создать. Если в том же install есть skills/rules/instructions, materialize идёт раньше MCP и может создать `.claude/`, `.gemini/`, `.kiro/` или `.agents/`; тогда MCP запишется.

Формально интеграции не совсем молчат: они возвращают diagnostics с кодами `CLAUDE_MCP_SKIP_NO_CLAUDE_DIR`, `GEMINI_MCP_SKIP_NO_GEMINI_DIR`, `KIRO_MCP_SKIP_NO_KIRO_DIR`, `ANTIGRAVITY_MCP_SKIP_NO_AGENTS_DIR`. Но CLI-фильтр `emitTrustDiagnostics` печатает только сообщения про withhold/unapproved/trust, поэтому пользователь видит `installed for claude` и `exit 0` без предупреждения.

## Влияние

- **Сценарий:** новый репозиторий, `bapm install --only mcp --target claude` (или gemini/kiro/antigravity); каталога агента ещё нет.
- **Кого задевает:** новичок, CI с чистым checkout, команда, мигрирующая с Cursor.
- **Последствие:** MCP-сервер не появляется, install успешен; в lock/inventory могут остаться declarations без фактического host-конфига.
- **Частота:** каждый MCP-only install для этих четырёх хостов на чистом дереве; при наличии skills в том же пакете — редко.
- **Обходной путь:** `mkdir .claude` (или `.gemini`, `.kiro`, `.agents`) и повторить install; либо поставить пакет со skills/rules в том же запуске.

## Состояние

| Источник     | Позиция                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| APM          | Адаптеры сами решают, создавать ли host dir.                                                             |
| OpenAPM      | Писать только под registered deploy roots; mkdir — на интеграции.                                        |
| Спека bapm   | Target-owned MCP path; fail если configure вернул пустой path — но хост может решить не конфигурировать. |
| Код bapm     | `createClaudeIntegration`, Gemini, Kiro, Antigravity: early return без каталога. Cursor: mkdir.          |
| Тесты        | У каждого хоста есть тест «skips when dir absent»; install-уровня теста на молчание нет.                 |
| Документация | `guide/supported-hosts.md:53`, `reference/install.md:55`, `policy-mcp.md:58`.                            |

## Проверка

| Артефакт | Где смотреть |
| -------- | ------------ |
| Код      | `packages/integration-claude/src/createClaudeIntegration.ts:183` — early return без `.claude/`; `packages/integration-gemini/src/createGeminiIntegration.ts:234`; `packages/integration-kiro/src/createKiroIntegration.ts:217`; `packages/integration-antigravity/src/createAntigravityIntegration.ts:234`; `packages/integration-cursor/src/createCursorIntegration.ts:188` — `mkdirSync(.cursor)`; `packages/core/src/modules/Install/runInstall.ts:438` — materialize до MCP (`:498`). |
| Тесты    | `integration-claude/tests/mcp/configure-mcp.test.ts:54`, Gemini `:72`, Kiro `:65`, Antigravity `:53` — skip без каталога. |
| Спека    | `openspec/specs/integration-claude-runtime/spec.md:118`, `integration-gemini-runtime/spec.md:103`, `integration-kiro-runtime/spec.md:89`, `integration-antigravity-runtime/spec.md:101`. |
| Docs     | `apps/docs/guide/supported-hosts.md:53`, `apps/docs/reference/install.md:55`. |

Воспроизведение:

```bash
repo=$PWD
d=$(mktemp -d) && mkdir -p "$d/dep" "$d/node_modules/@b-apm"
ln -s "$repo/packages/integration-claude" "$d/node_modules/@b-apm/integration-claude"
printf 'name: mcp-dep\nversion: 0.0.1\ndependencies:\n  mcp:\n    - name: dep-server\n      type: stdio\n      command: echo\n' > "$d/dep/apm.yml"
printf 'name: root\nversion: 0.0.1\ntarget: claude\nexecutables:\n  allow:\n    mcp-dep: { mcp: true }\ndependencies:\n  apm:\n    - path: ./dep\n' > "$d/bapm.yml"
cd "$d"
node "$repo/packages/cli/dist/cli.mjs" install --target claude; echo "exit=$?"; ls -a .mcp.json .claude
mkdir .claude
node "$repo/packages/cli/dist/cli.mjs" install --target claude; echo "retry=$?"
node -e 'console.log(Object.keys(require("./.mcp.json").mcpServers))'
```

Ожидание: если MCP есть, а каталога нет — warning или создание каталога.  
Факт: первый install `exit 0`, `.mcp.json` и `.claude` отсутствуют, предупреждения нет; после `mkdir .claude` второй install создаёт `.mcp.json` с `dep-server`.

## Вариации

1. Всегда создавать каталог агента при MCP-only install.
2. Текущее: зависит от хоста.
3. Падать с ошибкой, если MCP есть, а каталога нет — сейчас тихий skip.

## Рекомендация

Вариант 2 плюс видимая диагностика: печатать skip-код в обычном выводе (не только в отладочном), с точной командой `mkdir`. Для `--only mcp` можно рекомендовать вариант 1 только для явно выбранного `--target`, не меняя auto-detect. Оценка S: пробросить diagnostics materialize/configureMcp в CLI-вывод и добавить install-e2e тест; M — если разрешать mkdir для MCP-only.

Критерии закрытия:

- [ ] MCP-only install без каталога печатает warning с путём и действием;
- [ ] поведение покрыто install-тестом, а не только adapter-тестом;
- [ ] docs описывают opt-in и обход;
- [ ] решение по mkdir зафиксировано в спеке.

## Поведение сейчас

`bapm install --only mcp` в пустом репо для Claude не создаст `.mcp.json`; то же для Gemini/Kiro/Antigravity. Обход: `mkdir .claude` и повторить, либо поставить пакет со skills в том же запуске. CLI завершается `0` и пишет только `installed for claude`.

## Связанные

- [skipped-primitives-silent.md](./skipped-primitives-silent.md) — та же проблема с потерей diagnostics.
- [copilot-windsurf-home-mcp.md](./copilot-windsurf-home-mcp.md) — хосты, которые пишут MCP в `$HOME`.
