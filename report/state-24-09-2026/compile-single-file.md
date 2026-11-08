# `compile` пишет один файл

**Статус:** намеренно\
**Класс:** намеренное отличие\
**Важность:** низкая — осознанный выбор с понятным обходом (`-o`); риск ограничен перезаписью одного файла при сборке под несколько агентов.  
**Проверено:** 08-11-2026, working tree

## Суть

APM умеет раскладывать инструкции по каталогам через `applyTo`: один прогон создаёт несколько файлов под разные области проекта. bapm собирает **один** файл инструкций на **один** агент за запуск. Выбор агента идёт по `--target`, затем по `active`, затем по auto-detect; при нескольких active без `--target` команда падает (`packages/core/src/modules/Compile/compileAgentsMd.ts:107-121`).

Файл пишется в корень проекта или в путь, заданный `-o`. У нескольких хостов имя по умолчанию совпадает: `AGENTS.md` используют Cursor, Codex, OpenCode, Kiro, Grok Build и Antigravity; Claude — `CLAUDE.md`, Gemini — `GEMINI.md`, Copilot — `.github/copilot-instructions.md`. Поэтому повторный `compile` для другого агента из «AGENTS.md-семейства» перезапишет предыдущий файл, а не создаст рядом второй.

Это осознанное упрощение: bapm не заявляет per-path `applyTo`, а пользовательская таблица путей и `-o` остаются источником правды.

## Влияние

- **Сценарий:** монорепо, где нужны отдельные инструкции для `apps/web` и `packages/core`, или проект с несколькими AGENTS.md-хостами.
- **Кого задевает:** команды, мигрирующие с `apm compile`; пользователи с несколькими активными агентами.
- **Последствие:** нельзя получить несколько файлов за один прогон; при сборке под двух AGENTS.md-хостов остаётся только последний. `--target` обязателен, иначе multi-active даёт ошибку.
- **Частота:** каждый проект с несколькими хостами или с потребностью в per-directory инструкциях.
- **Обходной путь:** запускать `compile --target <id>` отдельно для каждого агента и раскладывать результат через `-o`; для разных каталогов — несколько запусков с разными `-o`.

## Состояние

| Источник     | Позиция                                                                                 |
| ------------ | --------------------------------------------------------------------------------------- |
| APM          | Compile/apply с распределением по путям (`applyTo`).                                    |
| OpenAPM      | Producer/compile поверхность уже; per-path apply — не обязательный consumer claim bapm. |
| Спека bapm   | `cli-runtime-surface`: `compile --target`, один активный compile-capable id.            |
| Код bapm     | `bapm compile` пишет `AGENTS.md` / `CLAUDE.md` / … в корень или путь хоста.             |
| Документация | `guide/conformance.md`, `guide/situations/compile-agents.md`.                           |

## Проверка

| Артефакт | Где смотреть |
| -------- | ------------ |
| Код      | `packages/core/src/modules/Compile/compileAgentsMd.ts:29-45` — один `target.compile(...)` за вызов. |
| Код      | `packages/core/src/modules/Compile/compileAgentsMd.ts:107-121` — multi-active без `--target` → ошибка. |
| Код      | `packages/integration-cursor/src/createCursorIntegration.ts:70`, `integration-codex/...:68`, `integration-kiro/...:105`, `integration-grok-build/...:51`, `integration-antigravity/...:66` — общий `AGENTS.md`. |
| Тесты    | `packages/cli/tests/compile/{target-selection,active-selection,output-path}.test.ts`; `packages/core/tests/compile/target-capability-orchestration.test.ts`. |
| Спека    | `openspec/specs/cli-runtime-surface/spec.md` — один compile-capable id за запуск. |
| Docs     | `apps/docs/guide/situations/compile-agents.md:43-57` — таблица имён и отличие от APM. |

Воспроизведение:

```bash
mkdir -p /tmp/bapm-compile && cd /tmp/bapm-compile
printf 'name: demo\nversion: 0.1.0\nactive:\n  target: [cursor, codex]\n' > bapm.yml
bapm compile            # ошибка: pass --target
bapm compile --target cursor
bapm compile --target codex
ls AGENTS.md            # один файл, перезаписан вторым запуском
```

Ожидание (как в APM): несколько файлов по `applyTo`.  
Факт: один `AGENTS.md`; второй запуск меняет его содержимое, а не создаёт новый файл.

## Вариации

1. Как APM: несколько файлов по `applyTo`. Требует расширить контракт `compile` и все интеграции.
2. Один файл на агент (текущий выбор). - выбрано
3. Несколько агентов за один `compile` — отвергается: нужен `--target`, если `active` перечисляет нескольких.

## Рекомендация

Оставить вариант 2 и закрыть как намеренное отличие. Достаточно зафиксировать в `CONFORMANCE.md` ограничение «no per-path applyTo» и добавить в help предупреждение о перезаписи общего `AGENTS.md`. Оценка S.

Критерии закрытия:

- [ ] В `CONFORMANCE.md` и `guide/situations/compile-agents.md` явно сказано: per-path `applyTo` не поддерживается.
- [ ] Help `compile` предупреждает, что AGENTS.md-хосты делят один файл.
- [ ] Есть тест на последовательный compile двух AGENTS.md-хостов (фиксирует перезапись).

## Поведение сейчас

Один запуск — один агент — один файл. Cursor, Codex, OpenCode, Kiro, Grok Build и Antigravity делят имя `AGENTS.md`: повторный `compile` для другого из них перезапишет файл. `-o` меняет путь, но для Codex/OpenCode/Grok Build имя должно остаться `AGENTS.md`; Gemini ожидает `GEMINI.md`.

## Связанные

- [conformance-beyond-cursor.md](./conformance-beyond-cursor.md) — §8.5 и честность заявленного покрытия.
- [stale-specs-compile-and-cursor.md](./stale-specs-compile-and-cursor.md) — устаревшая спека `compile-agents-md`.
