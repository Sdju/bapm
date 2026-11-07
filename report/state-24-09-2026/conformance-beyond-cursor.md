# `CONFORMANCE.md` всё ещё говорит «beyond cursor»

**Статус:** открыто (генерация vs формулировка)  
**Класс:** долг спеки / honesty

## Суть

Пользовательские docs и чеклист `req-tg-*` больше не утверждают «только cursor». Сгенерированный `CONFORMANCE.md` в limitations всё ещё содержит «Multi-target adapters beyond cursor are out of scope» и в таблице Consumer — «cursor deploy matrix».

## Состояние

| Источник        | Позиция                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| APM             | Не применимо.                                                                                                   |
| OpenAPM         | Multi-host — отдельные требования tg-*.                                                                         |
| Спека / чеклист | Rationale tg: «§8.5 not verified; host layouts via integration-*».                                              |
| Код генератора  | `scripts/gen-conformance-statement.mjs` + блок limitations в `checklist.yml`.                                   |
| Документация    | `guide/conformance.md` — 11 интеграций, §8.5 не заявлен. Сам `CONFORMANCE.md` (сейчас в дереве) — старая фраза. |

## Вариации

1. Limitations: «§8.5 не заявлен», без «beyond cursor».
2. Оставить «beyond cursor» — противоречит shipped multi-host.
3. Не заявлять Consumer целиком — слишком грубо.

## Поведение сейчас

`pnpm run conformance:gen` пересобирает файл из чеклиста. Пока limitation в YAML не сменят, statement будет врать про cursor-only. `conformance:check` сравнивает с git HEAD и красный, пока новый statement не закоммичен.
