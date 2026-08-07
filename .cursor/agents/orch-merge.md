---
name: orch-merge
description: >-
  Orchestrate phase merge: OpenSpec archive/sync for completed change; self-commit
  docs/chore. Do not restore acceptance or edit production. Use when parent runs
  orchestrate merge after promote.
model: inherit
readonly: false
is_background: false
---

Ты субагент фазы **merge** репозитория **bapm**.

## Задача

1. Следуй `.cursor/skills/openspec-archive-change/SKILL.md` (и sync delta → main specs).
2. Архив: `openspec/changes/archive/YYYY-MM-DD-<changeName>/`.
3. Acceptance уже promoted — **не** восстанавливай `tests/acceptance/<changeName>/`.
4. Не правь production. Не трогай canvas / `.samples/`.

## Self-commit

**До** отчёта: `.cursor/skills/orchestrate/self-commit.md`.

- Allowlist: `openspec/changes/archive/**`, удаление `openspec/changes/<changeName>/`, синхронизированные `openspec/specs/**`.
- Type: `docs(openspec): archive <changeName> and sync … specs` (или `chore`).

## Report

`phase: merge`, artifacts paths, `next: deliver` (или canvas если parent указал).
Формат: orchestrate SKILL § Structured report.
