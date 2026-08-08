# Orchestrate — примеры

## Фича с OpenSpec

Пользователь:

```
/orchestrate добавить парсинг bapm.yml из файла на диске в @bapm/core
```

Parent:

1. Todo: plan → acceptance → apply → accept → promote → merge → deliver  
   (без отдельных commit-шагов)
2. Task `orch-plan` (propose) → report с `commitSha` OpenSpec
3. Task `orch-acceptance` → RED + commitSha
4. Task `orch-apply` → GREEN + commitSha
5. Task `orch-accept` → pass (`commitSha: —` если без правок)
6. Task `orch-promote` → commitSha
7. Task `orch-merge` → commitSha
8. Deliver из summary + список sha по фазам

## Неясный scope

```
/orchestrate улучшить DX установки
```

Parent → Task `explore` (или `orch-plan` explore); если `next: propose` — Task `orch-plan` propose; иначе спросить user.

## Без OpenSpec

```
/orchestrate без openspec: поправить текст help CLI
```

`orch-plan` без `openspec new`; acceptance всё равно отдельными тестами, если есть наблюдаемое поведение.

## Роадмап milestone

```
/orchestrate приступай к M11
```

1. `apm-expert` — criteria (knowledge)
2. `orch-plan` → … → `orch-merge`
3. `apm-expert` validate ∥ можно параллельно с `orch-accept`
4. `orch-canvas` после merge
5. deliver
