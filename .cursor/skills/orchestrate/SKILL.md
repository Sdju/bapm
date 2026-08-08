---
name: orchestrate
description: >-
  Оркестратор реализации только через субагентов orch-*: OpenSpec plan,
  acceptance RED, apply GREEN, accept, promote, merge; self-commit внутри фазы.
  Использовать при /orchestrate, «оркестратор», «через субагентов».
disable-model-invocation: false
---

# Orchestrate — протокол parent → orch-* agents

Parent = диспетчер. Вся работа — в **Task** с `subagent_type` = агент из `.cursor/agents/orch-*.md` (или `apm-expert` / `explore` где указано).

## Инварианты parent

1. Не используй Read/Edit/Write/Grep/Shell/Glob для реализации, проверки или «сверки» результата.
2. Не вызывай `openspec`, `vp`, `git` сам — только субагент.
3. Решения next-step — **только** из structured report субагента.
4. Параллель: только независимые read-only (типично `orch-accept` ∥ `apm-expert` validate). Цепочка `acceptance → apply → accept → promote → merge` последовательна.
5. **Не** запускай отдельный commit-субагент. Фазовый агент **сам** коммитит после успеха **до** отчёта (см. `self-commit.md`).
6. Промпт Task: `changeName`, задача/gaps, workspace path; детали роли — в агенте. Не дублируй весь skill в промпт.

## Агенты и pipeline

| #   | Фаза               | `subagent_type`                                                    | Self-commit              |
| --- | ------------------ | ------------------------------------------------------------------ | ------------------------ |
| —   | criteria (роадмап) | `apm-expert`                                                       | нет                      |
| 1   | `plan`             | `orch-plan` (explore: можно `explore` → затем `orch-plan` propose) | propose: да              |
| 2   | `acceptance`       | `orch-acceptance`                                                  | да                       |
| 3   | `apply`            | `orch-apply`                                                       | да                       |
| 4   | `accept`           | `orch-accept`                                                      | только если правил файлы |
| —   | validate (роадмап) | `apm-expert`                                                       | нет                      |
| 5   | `promote`          | `orch-promote`                                                     | да                       |
| 6   | `merge`            | `orch-merge`                                                       | да                       |
| —   | canvas             | `orch-canvas`                                                      | нет                      |
| 7   | `deliver`          | — (parent)                                                         | —                        |

После `ok|pass`: проверь `commitSha` в отчёте, если фаза обязана коммитить. Пустой sha при грязных файлах фазы → эскалация / ретрай того же агента с «докажи commit».  
**Не** порождай `shell`/`generalPurpose` «только для commit».

`run_in_background`: false для фаз pipeline.

## OpenSpec (опционально)

| Ситуация       | `orch-plan`                            |
| -------------- | -------------------------------------- |
| Неясный scope  | сначала `explore`, потом propose       |
| Ясная фича     | сразу propose                          |
| «без openspec» | мини-plan в отчёте, без `openspec new` |

## TDD (кратко)

Детали — в агентах. Parent проверяет по отчёту:

- **acceptance:** `tdd: red`
- **apply:** `tdd: green`
- **accept:** `pass` → обязательно `promote` (не оставлять suite в `tests/acceptance/`)
- **promote:** acceptance dir исчез; затем `merge`

## Self-commit

Канон: `.cursor/skills/orchestrate/self-commit.md` (агенты обязаны следовать).

| Фаза         | type                   |
| ------------ | ---------------------- |
| plan propose | `docs` / `chore`       |
| acceptance   | `test`                 |
| apply        | `feat` / `fix`         |
| accept       | skip или `test`/`docs` |
| promote      | `test` / `refactor`    |
| merge        | `docs` / `chore`       |

## Structured report

```markdown
## Report

- phase: plan|acceptance|apply|accept|promote|merge|canvas
- status: ok|blocked|fail|pass
- changeName: <kebab|none>
- openspec: used|skipped
- artifacts: <paths or —>
- acceptanceTests: <paths before promote, or — after>
- promotedTests: <new general test paths or —>
- deletedTests: <removed paths + why, or —>
- commandsRun: <list>
- tdd: red|green|n/a + evidence one-liner
- commitSha: <sha or —>
- commitMessage: <full message or —>
- next: <рекомендация parent>
- summary: <3–6 строк для пользователя>
- blockedReason: <если blocked>
```

Parent → user: `summary` + `status` + commit refs; детали по запросу.

## Prompt templates (короткие)

Подставляй `{{TASK}}`, `{{CHANGE}}`, `{{GAPS}}`, `{{PLAN_REPORT}}`, workspace.

### plan

```
Фаза plan. Режим: propose|explore. Задача: {{TASK}}
Workspace: <repo root>
Следуй своему агент-промпту orch-plan + skills openspec-*. Self-commit по self-commit.md.
```

### acceptance

```
Фаза acceptance. Change: {{CHANGE}}. Контекст: {{PLAN_REPORT}}
Workspace: <repo root>
RED only; self-commit acceptance suite.
```

### apply

```
Фаза apply. Change: {{CHANGE}}. Acceptance уже в tests/acceptance/{{CHANGE}}/.
Workspace: <repo root>
GREEN; не ослабляй acceptance; self-commit feat/fix; не archive.
```

### accept

```
Фаза accept. Change: {{CHANGE}}. Gaps: {{GAPS}}
Workspace: <repo root>
Read-only к фиче; не promote; commit только если правил файлы.
```

### promote

```
Фаза promote. Change: {{CHANGE}}.
Workspace: <repo root>
Move/delete acceptance → general; GREEN; self-commit; не archive.
```

### merge

```
Фаза merge. Change: {{CHANGE}}.
Workspace: <repo root>
Archive/sync OpenSpec; self-commit; не трогай production/acceptance.
```

### canvas

```
Фаза canvas. Milestone: {{CHANGE}} или Mn. Данные: <progress, next, notes, verdict>
Обнови roadmap canvas; без git.
```

## Deliver

1. Статус pipeline
2. `changeName`, openspec used/skipped
3. Promote paths / deletions
4. 3–5 пунктов из summary
5. Коммиты из **отчётов фаз** (`commitSha` + message) — не из отдельного commit-агента
6. Blocked / не сделано

Без собственного code review.
