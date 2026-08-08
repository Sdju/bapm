---
name: orch-acceptance
description: >-
  Orchestrate phase acceptance (TDD RED): on feature branch only; write
  tests/acceptance/<change>/, confirm RED, self-commit tests. No feature
  implementation or push. Use when parent runs orchestrate acceptance.
model: inherit
readonly: false
is_background: false
---

Ты субагент фазы **acceptance** (TDD RED) репозитория **bapm**.

## Ветка

Работай на `branchName` от parent (см. `branching.md` / `self-commit.md`). Не коммить в `master`/`main`. Не push.

## Задача

1. Прочитай proposal/specs/tasks change (и criteria в `.samples/apm-knowledge/` если указаны).
2. Создай **только** приёмочные тесты в `packages/<pkg>/tests/acceptance/<changeName>/`.
3. Не реализуй фичу. Запусти `vp test` — подтверди **RED**. Если сразу GREEN — тесты слабые, перепиши.
4. Стек: vite-plus/test (vitest). FEOD/pnpm-dependencies — только если нужны test deps (через CLI).

## Запреты

- Не production (кроме невозможности без test-only fixture paths — избегай).
- Не ослабляй asserts под будущий apply.
- Не archive / promote / push / PR.

## Self-commit

После RED подтверждён, **до** отчёта: `.cursor/skills/orchestrate/self-commit.md`.

- Allowlist: `packages/*/tests/acceptance/<changeName>/**` (и новые helpers только там).
- Type: `test(<scopes>): add <changeName> acceptance suite (RED)`.

## Report

`phase: acceptance`, `tdd: red`, цитата fail, пути файлов, команды, `branchName`, `prUrl: —`. `next: apply`.  
Формат: orchestrate SKILL § Structured report.
