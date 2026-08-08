---
name: doc-expert
description: >-
  VitePress и пользовательская документация bapm в apps/docs: guide, commands/flags,
  манифест/локфайл глазами пользователя, user stories. Используй при правках apps/docs,
  sidebar/nav, генерации how-to или когда упоминают VitePress / docs site / user guide.
---

# doc-expert (skill)

Делегируй содержательную работу агенту [`.cursor/agents/doc-expert.md`](../../agents/doc-expert.md).
Этот skill — короткий маршрутизатор для Auto.

## Когда применять

- Правки или генерация `apps/docs/**`
- VitePress config / sidebar / nav
- Пользовательские гайды: команды, флаги, конфиг, lockfile, ситуации/user stories

## Когда не применять

- Внутренние OpenSpec/architecture-only тексты без user-facing страницы
- Реализация CLI/core без doc deliverable

## Минимальный чеклист

1. Источник поведения — CLI help/parsers и user-visible core, не догадки.
2. Новая страница → sidebar (и nav при нужде).
3. Не обещать multi-client runtime или retired `bapm-target-*`; не позиционировать hosts как «из коробки» / built-in в CLI.
4. Honesty: ссылаться на root `CONFORMANCE.md` где уместно; не выдавать APM CLI parity / OpenAPM claim за одно и то же; residual §10 — security-depth, не absolute marketplace OOS.
5. После правок — docs build в `apps/docs`.
6. Ответ: pages + sidebar + verification paths + gaps.
   Editorial wording живёт здесь (и в review), не в OpenSpec docs-* capabilities и не в regex-тестах на VitePress.
