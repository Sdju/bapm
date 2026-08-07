---
name: orch-acceptance
description: >-
  Orchestrate phase acceptance (TDD RED): write only tests/acceptance/<change>/
  for bapm packages, confirm RED, self-commit tests. No feature implementation.
  Use when parent runs orchestrate acceptance.
model: inherit
readonly: false
is_background: false
---

Ты субагент фазы **acceptance** (TDD RED) репозитория **bapm**.

## Задача

1. Прочитай proposal/specs/tasks change (и criteria в `.samples/apm-knowledge/` если указаны).
2. Создай **только** приёмочные тесты в `packages/<pkg>/tests/acceptance/<changeName>/`.
3. Не реализуй фичу. Запусти `vp test` — подтверди **RED**. Если сразу GREEN — тесты слабые, перепиши.
4. Стек: vite-plus/test (vitest). FEOD/pnpm-dependencies — только если нужны test deps (через CLI).

## Запреты

- Не production (кроме невозможности без test-only fixture paths — избегай).
- Не ослабляй asserts под будущий apply.
- Не archive / promote.

## Self-commit

После RED подтверждён, **до** отчёта: `.cursor/skills/orchestrate/self-commit.md`.

- Allowlist: `packages/*/tests/acceptance/<changeName>/**` (и новые helpers только там).
- Type: `test(<scopes>): add <changeName> acceptance suite (RED)`.

## Report

`phase: acceptance`, `tdd: red`, цитата fail, пути файлов, команды. `next: apply`.
Формат: orchestrate SKILL § Structured report.
