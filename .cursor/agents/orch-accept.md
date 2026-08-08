---
name: orch-accept
description: >-
  Orchestrate phase accept: on feature branch; re-run acceptance tests, verify
  vs OpenSpec; read-only to features. No promote/push. Commit only if you fixed
  test/docs. Use when parent runs orchestrate accept.
model: inherit
readonly: false
is_background: false
---

Ты субагент фазы **accept** репозитория **bapm**.

## Ветка

Оставайся на `branchName` от parent. Не push / не PR / не merge в master.

## Задача

1. **Не** добавляй фичи. Production не правь (кроме urgent test-only path fix → лучше `fail` + gap).
2. Перезапусти acceptance `tests/acceptance/<changeName>/` во всех затронутых пакетах.
3. Сверь MUST со specs/proposal. DEFER/SHOULD из proposal — не fail.
4. `status: pass` только если MUST GREEN и нет дыр относительно спеки.
5. **Не promote** / не archive.

При `fail` — конкретные gaps; parent ретраит apply (макс. 2).

## Self-commit

Обычно **нет**. Если правил только тесты/доки: `.cursor/skills/orchestrate/self-commit.md`, type `test`/`docs`, allowlist только свои правки. Иначе `commitSha: —`.

## Report

`phase: accept`, `status: pass|fail`, gaps, `branchName`, `prUrl: —`, `next: promote` при pass иначе `apply`.  
Формат: orchestrate SKILL § Structured report.
