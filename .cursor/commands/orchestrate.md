---
name: "/orchestrate"
id: "orchestrate"
category: "Workflow"
description: "Оркестратор: orch-* субагенты, self-commit в фазе, TDD acceptance→promote"
---

Оркестрируй реализацию **только через субагентов**. Сам код, тесты, спеки и проверки **не трогай**.

Перед стартом прочитай skill: `.cursor/skills/orchestrate/SKILL.md` и следуй ему целиком.

**Input**: описание задачи после `/orchestrate` (или уточни у пользователя, если пусто).

## Жёсткие запреты оркестратора (parent)

- Не читай/не правь исходники, спеки, тесты ради реализации или приёмки.
- Не запускай `vp test` / `vp check` / сборку / OpenSpec CLI / **git** сам.
- Не «быстро глянь diff» и не верифицируй работу субагента своими глазами.
- Единственные инструменты: **Task** (субагенты), вопросы пользователю, краткий статус фаз.
- Если нужно узнать о репо — субагент (`explore` / `orch-plan`), не исследуй сам.
- **Не** создавай отдельный commit-субагент: фаза коммитит сама (см. skill `self-commit.md`).

## Pipeline

| # | Фаза | `subagent_type` | Цель |
|---|------|-----------------|------|
| 1 | `plan` | `orch-plan` | explore/propose + self-commit OpenSpec |
| 2 | `acceptance` | `orch-acceptance` | приёмочные тесты RED + self-commit |
| 3 | `apply` | `orch-apply` | реализация GREEN + self-commit |
| 4 | `accept` | `orch-accept` | приёмка; commit только если правил файлы |
| 5 | `promote` | `orch-promote` | acceptance → general / delete + self-commit |
| 6 | `merge` | `orch-merge` | archive/sync + self-commit |
| — | canvas | `orch-canvas` | roadmap canvas (вне git), по необходимости |
| 7 | `deliver` | — | отчёт пользователю из reports |

Роадмап criteria/validate: `apm-expert` (без git).  
OpenSpec опционален («без openspec» → мини-plan в `orch-plan`).

## Self-commit (внутри фазы)

Агент после `ok`/`pass` коммитит **до** отчёта. Parent проверяет `commitSha` в report и идёт дальше. Типы: plan `docs`/`chore`, acceptance `test`, apply `feat`/`fix`, promote `test`/`refactor`, merge `docs`/`chore`.

Если фаза обязана коммитить, а `commitSha` пуст при ожидаемых изменениях — остановись / ретрай агента, не запускай отдельный commit Task.

## Старт

1. Нет задачи — спроси одной фразой.
2. Todo: `plan → acceptance → apply → accept → promote → merge → deliver` (**без** отдельных commit-todo).
3. Task `orch-plan` с коротким промптом из skill.
4. После каждого: обнови todo; next **по отчёту** (`commitSha` уже в нём).
5. Deliver: change name, сделано, promote, archive, **коммиты из phase reports**.

## Эскалация

`blocked` / неоднозначный выбор / `accept` fail дважды → спроси user.
