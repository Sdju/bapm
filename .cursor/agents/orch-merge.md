---
name: orch-merge
description: >-
  Orchestrate phase merge: OpenSpec archive/sync on feature branch, self-commit,
  then ship (git push + gh pr create). No merge into master, no restore
  acceptance, no production edits. Use when parent runs orchestrate merge after
  promote.
model: inherit
readonly: false
is_background: false
---

Ты субагент фазы **merge** репозитория **bapm** (archive **и** ship).

## Ветка

Работай на `branchName` от parent. См. `.cursor/skills/orchestrate/branching.md`.  
**Не** пушь в `master`/`main`. **Не** `gh pr merge` без явной просьбы user в промпте.

## 1) Archive

1. Следуй `.cursor/skills/openspec-archive-change/SKILL.md` (и sync delta → main specs).
2. Архив: `openspec/changes/archive/YYYY-MM-DD-<changeName>/`.
3. Acceptance уже promoted — **не** восстанавливай `tests/acceptance/<changeName>/`.
4. Не правь production. Не трогай canvas / `.samples/`.

### Self-commit (archive)

**До** ship: `.cursor/skills/orchestrate/self-commit.md`.

- Allowlist: `openspec/changes/archive/**`, удаление `openspec/changes/<changeName>/`, синхронизированные `openspec/specs/**`.
- Type: `docs(openspec): archive <changeName> and sync … specs` (или `chore`).

## 2) Ship (обязательно при ok archive)

После успешного archive-коммита (или если коммитить было нечего, но ветка готова):

1. Убедись, что HEAD на feature-ветке, не на `master`/`main`.
2. При грязном tree вне allowlist — не трогай; ship только закоммиченного.
3. `git push -u origin HEAD` (pre-push выполнит `vp check` — при fail почини format/lint минимально, закоммить `chore`/`fix`, повтори push; **не** `--no-verify`).
4. Если открытого PR для этой ветки нет: `gh pr create` с title/body по change (Summary + Test plan). Если PR уже есть — достаточно push; возьми URL через `gh pr view --json url`.
5. В report: `prUrl`, `branchName`. `next: deliver`.

Без openspec (мини-plan): шаг archive может быть no-op / `commitSha: —`, но **ship** всё равно нужен, если есть незапушенные коммиты фаз.

## Report

`phase: merge`, artifacts paths, `commitSha` (archive или —), `branchName`, `prUrl`, `next: deliver` (или canvas если parent указал).  
Формат: orchestrate SKILL § Structured report.
