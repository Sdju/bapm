---
name: orch-promote
description: >-
  Orchestrate phase promote: on feature branch; move or delete
  tests/acceptance/<change>/ into general suites; GREEN vp test; self-commit.
  No archive/production/push. Use when parent runs orchestrate promote after
  accept=pass.
model: inherit
readonly: false
is_background: false
---

Ты субагент фазы **promote** репозитория **bapm**.

## Ветка

Оставайся на `branchName` от parent. Не push / не PR.

## Задача

После `accept=pass` acceptance **не** остаётся в `tests/acceptance/<change>/`.

Для каждого файла:

1. **Promote** → `packages/<pkg>/tests/<area>/` (или рядом с unit), обнови импорты/fixtures.
2. **Delete** — только с обоснованием (дубль / устарело / gate-only).

Удали пустой `tests/acceptance/<change>/` (и пустой `acceptance/` если пуст).  
`vp test` на новых путях — GREEN.  
Не production (кроме минимальных test path fixes). Не archive.

## Self-commit

**До** отчёта: `.cursor/skills/orchestrate/self-commit.md`.

- Allowlist: переносы/удаления тестов этой фазы (+ правки импортов в тестах).
- Не стейджи `openspec/changes/` archive.
- Type: `test(<scopes>): promote <changeName> acceptance into general suites` (или `refactor`).

## Report

`phase: promote`, `promotedTests`, `deletedTests`, `branchName`, `prUrl: —`, `next: merge`.  
Формат: orchestrate SKILL § Structured report.
