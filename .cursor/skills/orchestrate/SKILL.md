---
name: orchestrate
description: >-
  Оркестратор реализации только через субагентов: OpenSpec explore/propose,
  отдельные приёмочные тесты (TDD), apply, приёмка, merge. Использовать при
  /orchestrate, «оркестратор», «через субагентов», или когда нельзя самому
  лезть в код/тесты/спеки — только Task.
disable-model-invocation: false
---

# Orchestrate — протокол parent → subagents

Parent = диспетчер. Вся работа (чтение репо, OpenSpec, тесты, код, приёмка) — в **Task**.

## Инварианты parent

1. Не используй Read/Edit/Write/Grep/Shell/Glob для реализации, проверки или «сверки» результата.
2. Не вызывай `openspec`, `vp`, `git` сам — только субагент (включая conventional commits после успешных фаз).
3. Решения next-step принимай **только** из structured report субагента.
4. Параллель разрешена только для независимых read-only explore; фазы `acceptance → apply → accept → promote → merge` строго последовательны; **commit после ok/pass — до следующей фазы**.
5. Промпт субагента должен быть самодостаточным: цель, пути, TDD-правила, формат отчёта, что запрещено.

## OpenSpec (опционально)

| Ситуация | Фаза `plan` |
|----------|-------------|
| Фича / неясный scope | субагент следует `.cursor/skills/openspec-explore/SKILL.md` **или** `.cursor/commands/opsx-explore.md` |
| Ясная фича, нужна запись change | субагент следует openspec-propose / `/opsx-propose` |
| Пользователь: «без openspec» | субагент пишет короткий plan (цель, критерии приёмки, затронутые пакеты) в отчёте; change name = kebab-case из задачи |

После propose субагент обязан вернуть: `changeName`, пути proposal/specs/design/tasks, `openspec validate` ok/fail.

## TDD для субагентов

### Приёмочные тесты (фаза `acceptance`) — отдельно

- Пишутся **до** apply, по спеке / критериям приёмки.
- Каталог: `tests/acceptance/<change-name>/` в затронутом пакете (`packages/core`, `packages/cli`, …). Если пакет неочевиден — спросить через parent → user, не угадывать молча.
- Не смешивать с unit-тестами в `tests/` корня пакета (кроме `tests/acceptance/`).
- Стек: `vite-plus/test` (vitest), как в существующих пакетах.
- Обязательный RED: после написания субагент запускает тесты и подтверждает **падение** (или явный fail assertion). Если всё зелёное сразу — тесты слишком слабые, переписать.
- В отчёте: список файлов, команда запуска, цитата fail.

### Apply (фаза `apply`)

- Реализует tasks/спеку; может писать unit-тесты рядом с кодом.
- **Не удаляет и не ослабляет** acceptance-тесты без явного ok от accept-фазы.
- Цикл: код → `vp test` (acceptance + unit) → пока acceptance GREEN.
- Следует FEOD для `packages/cli`, pnpm-dependencies skill для deps, `vp` для check/test/pack.
- В конце: GREEN acceptance + краткий список изменённых файлов.

### Accept (фаза `accept`)

- Read-only к фиче: не добавляет поведение.
- Перезапускает acceptance-тесты; сверяет с proposal/specs (через OpenSpec show/status или чтение артефактов).
- Вердикт: `pass` | `fail` + конкретные gaps. При `fail` — parent запускает `apply` снова с gaps (макс. 2 ретрая, потом эскалация user).
- При `pass` — **обязательно** следующая фаза `promote` (не оставлять suite навсегда в `tests/acceptance/`).

### Promote (фаза `promote`) — после успешной приёмки

После `accept=pass` приёмочные тесты **не остаются** в `tests/acceptance/<change>/` как постоянный слой.

Субагент для каждого файла/кейса выбирает:

1. **Promote** — перенести в общие тесты пакета (например `tests/manifest/`, `tests/lockfile/`, `tests/architecture/`, или рядом с unit в `tests/`), сохранив покрытие; обновить импорты/пути fixtures.
2. **Delete** — удалить, если кейс дублирует unit/уже не отражает продукт / был только gate для change.

Правила:

- Каталог `tests/acceptance/<change>/` после promote должен **исчезнуть** (или остаться пустым и быть удалён).
- Не ослаблять покрытие молча: если удаляешь — в отчёте явное обоснование; полезные кейсы обязательно promote.
- Прогнать `vp test` по затронутому пакету — GREEN.
- Не менять production-код (кроме минимальных test-only path fixes).

### Merge (фаза `merge`)

- При OpenSpec: archive/sync по `.cursor/skills/openspec-archive-change` / sync (как `/opsx-archive`).
- К моменту merge acceptance уже **promoted или удалены** (фаза `promote` до merge).
- После успешного archive parent запускает commit-субагента (`chore:`), затем `deliver`.

### Conventional commits (после успешных фаз)

После фазы со `status: ok` | `pass` parent **всегда** запускает субагента `commit` (кроме: explore без файлов; accept без изменений; `deliver`). Не ждать отдельной просьбы пользователя о коммите.

| После | `type` | Содержание |
|-------|--------|------------|
| plan propose | `docs` или `chore` | OpenSpec artifacts |
| acceptance | `test` | acceptance/e2e (RED) |
| apply | `feat` или `fix` | implementation + unit |
| accept | skip или `test`/`docs` | только если были правки |
| promote | `test` или `refactor` | move/delete acceptance → general |
| merge | `chore` | archive/sync |

Правила коммит-субагента:

- Conventional Commits: `type(scope): summary` (+ body по необходимости).
- Scope: пакет (`core`, `cli`) и/или `changeName`.
- Один коммит = одна успешная фаза; не смешивать фазы.
- Следовать user rule committing-changes-with-git (status/diff/log → stage → HEREDOC commit → status); не `push` без явной просьбы; не секреты; не `--no-verify` / amend / force без явного ok.
- В отчёте: `commitSha`, `commitMessage`.

## Structured report (обязателен от каждого субагента)

```markdown
## Report
- phase: plan|acceptance|apply|accept|promote|merge|commit
- status: ok|blocked|fail
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

Parent пересказывает пользователю только `summary` + `status` (+ короткие commit refs); детали по запросу.

## Prompt templates

Подставляй `{{TASK}}`, `{{CHANGE}}`, `{{PACKAGE}}`, `{{GAPS}}`, `{{PLAN_REPORT}}`.

### plan — explore

```
Ты субагент фазы plan (explore) репозитория bapm.
Задача пользователя: {{TASK}}

Следуй .cursor/skills/openspec-explore/SKILL.md (или команде opsx-explore).
Не реализуй код. Верни structured report (phase: plan). Рекомендуй propose или сразу acceptance.
```

### plan — propose

```
Ты субагент фазы plan (propose) репозитория bapm.
Задача: {{TASK}}

Следуй .cursor/skills/openspec-propose/SKILL.md. Создай change и все артефакты.
Не пиши production-код и не пиши acceptance-тесты.
Верни structured report с changeName и путями артефактов. next: acceptance.
```

### acceptance

```
Ты субагент фазы acceptance (TDD RED) репозитория bapm.
Change: {{CHANGE}}
Контекст плана: {{PLAN_REPORT}}

1. Прочитай proposal/specs/tasks change (OpenSpec или plan report).
2. Создай ТОЛЬКО приёмочные тесты в tests/acceptance/{{CHANGE}}/ нужного пакета.
3. Не реализуй фичу. Запусти тесты — подтверди RED.
4. Учти FEOD (packages/cli) и pnpm-dependencies при новых deps.
Верни structured report (phase: acceptance, tdd: red).
```

### apply

```
Ты субагент фазы apply репозитория bapm.
Change: {{CHANGE}}
Acceptance tests: уже написаны (см. tests/acceptance/{{CHANGE}}/). Не ослабляй их.

1. Следуй openspec-apply / opsx-apply для change {{CHANGE}}.
2. TDD: доведи acceptance до GREEN; unit-тесты по необходимости.
3. FEOD для packages/cli; deps только через pnpm CLI/catalog; сборка/проверка через vp.
4. Не делай openspec archive.
Верни structured report (phase: apply, tdd: green|fail).
```

### accept

```
Ты субагент фазы accept репозитория bapm.
Change: {{CHANGE}}
Прошлые gaps (если есть): {{GAPS}}

1. Не добавляй фичи. Перезапусти acceptance-тесты.
2. Сверь поведение со specs/proposal.
3. status=pass только если acceptance GREEN и нет дыр относительно спеки.
4. Не переноси/не удаляй acceptance здесь — это фаза promote после pass.
Верни structured report (phase: accept). next: promote при pass.
```

### promote

```
Ты субагент фазы promote репозитория bapm.
Change: {{CHANGE}}
Acceptance path: tests/acceptance/{{CHANGE}}/ в затронутом пакете.

После успешной приёмки:
1. Для каждого acceptance/e2e файла: либо ПЕРЕНЕСИ в общие тесты пакета
   (tests/<area>/… или tests/ рядом с unit — без каталога acceptance/),
   либо УДАЛИ с явным обоснованием (дубль unit / устарело / только gate change).
2. Удали пустой tests/acceptance/{{CHANGE}}/ (и fixtures перенеси вместе с promoted).
3. Не ослабляй покрытие без причины. Не меняй production-код.
4. Запусти vp test по пакету — подтверди GREEN.
Верни structured report (phase: promote) с promotedTests и deletedTests. next: merge.
```

### merge

```
Ты субагент фазы merge репозитория bapm.
Change: {{CHANGE}}

1. Если OpenSpec использовался — archive/sync по openspec-archive-change.
2. Acceptance к этому моменту уже promoted/deleted — не восстанавливай tests/acceptance/{{CHANGE}}/.
3. Не коммить здесь — parent отдельно запустит commit-субагента после ok.
Верни structured report (phase: merge).
```

### commit (после успешной фазы)

```
Ты субагент фазы commit репозитория bapm.
Change: {{CHANGE}}
После фазы: {{PRIOR_PHASE}} (status ok/pass).
Ожидаемый conventional type: {{COMMIT_TYPE}} (docs|chore|test|feat|fix|refactor).
Scope: {{SCOPE}}.

1. Следуй user rule committing-changes-with-git: status, diff, log → stage только файлы этой фазы → commit через HEREDOC.
2. Сообщение: Conventional Commits — "{{COMMIT_TYPE}}({{SCOPE}}): …".
3. Не push. Не --no-verify / amend / force. Не коммить секреты и чужие dirty-файлы вне фазы.
4. Если нечего коммитить — status=ok, commitSha=—, next=следующая фаза pipeline.
Верни structured report (phase: commit) с commitSha и commitMessage.
```

## Выбор subagent_type

| Фаза | subagent_type | model |
|------|---------------|-------|
| plan explore | `explore` (medium/very thorough) | default |
| plan propose / acceptance / apply / promote / merge / commit | `generalPurpose` | default |
| accept (опционально доп. review) | `bugbot` / `security-review` только если user явно просил | — |

`run_in_background`: false для фаз pipeline (нужен отчёт). Параллель — только по явному указанию skill выше.

## Deliver

Parent пишет пользователю:

1. Статус pipeline (все фазы ok / где fail)
2. `changeName` и OpenSpec used/skipped
3. Куда promoted / что удалено из acceptance (из отчёта promote)
4. 3–5 пунктов «что сделано» из summary субагентов
5. Коммиты по фазам (`sha` + conventional message) из отчётов commit-субагентов
6. Что не сделано / blocked

Без собственного code review.
