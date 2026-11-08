# `CONFORMANCE.md` больше не говорит «beyond cursor»

**Статус:** исправлено (коммит `7ef7876`, change `sync-specs-with-shipped-behavior`)\
**Класс:** долг спеки / honesty → закрыто\
**Важность:** низкая (закрыто; исторически средняя) — заявление о покрытии приведено в соответствие с multi-host; регрессию сторожит `conformance:check`.  
**Проверено:** 08-11-2026, working tree

## Суть

Пользовательские docs и чеклист `req-tg-*` больше не утверждают «только cursor». Раньше сгенерированный `CONFORMANCE.md` в limitations содержал «Multi-target adapters beyond cursor are out of scope», а в таблице Consumer — «cursor deploy matrix». Это противоречило shipped-интеграциям для Claude, Gemini, Copilot, Windsurf, Codex, Kiro, Grok Build, Antigravity, OpenCode и Agent Skills.

Сейчас statement генерируется из `tests/spec-conformance/checklist.yml`. Актуальная формулировка ограничения: «OpenAPM §8.5 per-target layout is not claimed; host layouts are defined by the @b-apm/integration-* packages» (`CONFORMANCE.md:36`), а строка Consumer — «Primary claim (per-host @b-apm/integration-* packages; waivers below)» (`CONFORMANCE.md:20`). Слова «beyond cursor» в сгенерированном statement нет.

Это не меняет runtime: §8.5 по-прежнему не заявлен, раскладка остаётся per-integration. Закрыт именно дефект честности: документ больше не занижает покрытие и не обещает cursor-only.

## Влияние

- **Сценарий:** читатель `CONFORMANCE.md` или агент, работающий spec-first, выбирает bapm под Claude/Gemini и видит «beyond cursor out of scope».
- **Кого задевает:** пользователи, выбирающие инструмент по conformance; контрибьюторы, сверяющие claim с кодом.
- **Последствие (было):** неверный вывод о поддержке хостов; лишние вопросы и недоверие к statement.
- **Частота:** при каждом чтении сгенерированного statement; сейчас устранено.
- **Обходной путь:** не нужен; источник правды — `guide/supported-hosts.md` и integration-пакеты.

## Состояние

| Источник        | Позиция                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| APM             | Не применимо.                                                                                                   |
| OpenAPM         | Multi-host — отдельные требования tg-\*.                                                                        |
| Спека / чеклист | Rationale tg: «§8.5 not verified; host layouts via integration-\*».                                             |
| Код генератора  | `scripts/gen-conformance-statement.mjs` + блок limitations в `checklist.yml`.                                   |
| Документация    | `guide/conformance.md` — 11 интеграций, §8.5 не заявлен. Сам `CONFORMANCE.md` (сейчас в дереве) — старая фраза. |

## Проверка

| Артефакт | Где смотреть |
| -------- | ------------ |
| Statement | `CONFORMANCE.md:36` — «§8.5 not claimed», без «beyond cursor». |
| Statement | `CONFORMANCE.md:20` — Consumer: per-host integration packages. |
| Генератор | `scripts/gen-conformance-statement.mjs` — собирает limitations из checklist. |
| Чеклист | `tests/spec-conformance/checklist.yml:21` и rationale `req-tg-*` — §8.5, без cursor-only. |
| Тест | `pnpm run conformance:check` — drift check против HEAD. |

Проверка:

```bash
pnpm run conformance:check
rg -n "beyond cursor|cursor deploy matrix" CONFORMANCE.md CONFORMANCE.json
```

Ожидание: drift check `OK`, `rg` ничего не находит.  
Факт (08-11-2026): `conformance drift check: OK (no diff)`; совпадений в statement нет.

## Вариации

1. Limitations: «§8.5 не заявлен», без «beyond cursor». - выбрано
2. Оставить «beyond cursor» — противоречит shipped multi-host.
3. Не заявлять Consumer целиком — слишком грубо.

## Рекомендация

Оставить вариант 1. Регрессионный сторож уже есть — `conformance:check` в `ready`/CI. Добавить только текстовый тест, запрещающий `beyond cursor` в `CONFORMANCE.md`, если хочется явной страховки. Оценка S.

Критерии закрытия:

- [x] `CONFORMANCE.md` не содержит «beyond cursor» и «cursor deploy matrix».
- [x] `conformance:check` проходит на HEAD.
- [ ] (опционально) текстовый grep-тест в CI.

## Поведение сейчас

`pnpm run conformance:gen` пересобирает файл из чеклиста. `pnpm run conformance:check` сравнивает с git HEAD и зелёный: statement в дереве и сгенерированный совпадают. §8.5 остаётся незаявленным — это по-прежнему ограничение, а не скрытый pass.

## Связанные

- [openapm-8-5-layout.md](./openapm-8-5-layout.md) — §8.5 не заявлен, раскладка per-integration.
- [spec-legacy-active.md](./spec-legacy-active.md) — другая часть того же change синхронизации.
