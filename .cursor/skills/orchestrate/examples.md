# Orchestrate — примеры

## Фича с OpenSpec

Пользователь:

```
/orchestrate добавить парсинг bapm.yml из файла на диске в @b-apm/core
```

Parent:

1. Todo: plan → acceptance → apply → accept → promote → merge → deliver  
   (без отдельных commit-шагов; ship внутри merge)
2. Task `orch-plan` (propose) → report с `branchName` (`orch/…`) + `commitSha` OpenSpec
3. Task `orch-acceptance` (прокинь `branchName`) → RED + commitSha
4. Task `orch-apply` → GREEN + commitSha
5. Task `orch-accept` → pass (`commitSha: —` если без правок)
6. Task `orch-promote` → commitSha
7. Task `orch-merge` → archive commitSha + **ship** → `prUrl`
8. Deliver из summary + список sha + **ссылка на PR** (не merge в master сам)

## Неясный scope

```
/orchestrate улучшить DX установки
```

Parent → Task `explore` (или `orch-plan` explore); если `next: propose` — Task `orch-plan` propose (ветка); иначе спросить user.

## Без OpenSpec

```
/orchestrate без openspec: поправить текст help CLI
```

`orch-plan` без `openspec new`, но с feature-веткой; acceptance всё равно отдельными тестами, если есть наблюдаемое поведение; `orch-merge` ship всё равно пушит/открывает PR.

## Уже на feature-ветке / открытый PR

Если user уже на `feat/…` или `orch/…` — фазы **не** создают новую ветку; работают на текущей; ship обновляет существующий PR (`gh pr view`).

## Роадмап milestone

```
/orchestrate приступай к M11
```

1. `apm-expert` — criteria (knowledge)
2. `orch-plan` → … → `orch-merge` (с PR)
3. `apm-expert` validate ∥ можно параллельно с `orch-accept`
4. `orch-canvas` после merge
5. deliver (+ prUrl)
