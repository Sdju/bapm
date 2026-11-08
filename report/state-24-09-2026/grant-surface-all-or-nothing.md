# Любое разрешение включает проверку всех MCP-пакетов

**Статус:** намеренно (правило) / сюрприз UX  
**Класс:** продукт  
**Важность:** высокая — один `approve`/`deny` на машине или `executables.allow` в проекте переводит все dependency MCP в обязательный выбор и ломает install, включая CI с общим профилем.  
**Проверено:** 08-11-2026, working tree

## Суть

Пока grant-поверхности нет (и не передан `--trust-transitive-mcp`), транзитивный MCP просто не ставится: `collectMcpServers` включает dependency-серверы только при `trustTransitiveMcp` или `grantSurface.present`. Как только в проекте появляется `executables.allow`, а на машине — `bapm approve` или `bapm deny`, user/project surface становится `present`, и каждый пакет с MCP обязан быть явно разрешён или запрещён.

Дальше работает fail-closed: для каждого dependency-сервера вызывается `resolveExecutableTrust`; неразрешённый даёт `withhold`, а `withholdFatal` становится true, если есть surface или org deny. Install завершается ошибкой `MCP withheld: unapproved dependency executables (...)`, даже если проблема только в одном новом пакете.

Прямые серверы корня (`dependencies.mcp` самого проекта) в этот цикл не попадают: они добавляются как `direct` и всегда approved. Поэтому «всё или ничего» касается только MCP из зависимостей. `--trust-transitive-mcp` без surface, наоборот, ставит все dependency MCP, потому что резолвер возвращает `skip`.

## Влияние

- **Сценарий:** в `bapm.yml` добавили `executables.allow` для `acme/a` (или `approve` попал в общий CI-профиль); затем появляется зависимость `acme/b` с MCP, и install падает.
- **Кого задевает:** команда, CI, новый участник, автор пакета.
- **Последствие:** install не завершается, lock/MCP не обновляются; нужно разрешить или запретить каждый пакет из сообщения, включая транзитивные.
- **Частота:** каждый install после появления shared grant, особенно при добавлении зависимости с MCP; в CI — постоянно, если `~/.bapm/config.json` закеширован.
- **Обходной путь:** `executables.allow`/`bapm approve` для всех пакетов из сообщения либо `bapm deny` для ненужных; временно — `--trust-transitive-mcp` (ставит все dependency MCP) или убрать grant-поверхность.

## Состояние

| Источник           | Позиция                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| APM                | Approve ближе к интерактивному списку; отсутствие grant не обязательно включает fail-closed на все пакеты.         |
| OpenAPM sc-009/011 | Если лестница включена — deny-wins и полнота grant.                                                                |
| Спека bapm         | Collect включает dependency MCP, когда `trustTransitiveMcp` или `grantSurface.present`.                            |
| Код bapm           | `Mcp/collect.ts`: `includeDeps = trustTransitiveMcp \|\| grantSurface?.present`. Дальше withhold на неразрешённых. |
| Тесты              | sc-009 закрепляет withhold при surface; теста «один approve ломает второй пакет» нет.                              |
| Документация       | `policy-mcp.md:30` warning «Разрешения включаются для всех пакетов сразу».                                         |

## Проверка

| Артефакт | Где смотреть                                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Mcp/collect.ts:39` — `includeDeps`; `packages/core/src/modules/Install/runInstall.ts:883` — резолвер на каждый dependency-сервер; `:913` — `withholdFatal`. |
| Код      | `packages/core/src/modules/ExecutableTrust/userStore.ts:70` — `present` становится true от одного ключа `executables`, даже пустого.                                                   |
| Тесты    | `packages/cli/tests/mcp/sc-009-trust.test.ts:27` — surface + unapproved → withhold; `packages/core/tests/executable-trust/resolve-deny-wins.test.ts:48` — fail-closed.                 |
| Спека    | `openspec/specs/executable-mcp-trust/spec.md:23` — fail closed при grant surface; `:65` — unapproved withholds.                                                                        |
| Docs     | `apps/docs/guide/situations/policy-mcp.md:30` — предупреждение о всех пакетах сразу.                                                                                                   |

Воспроизведение:

```bash
repo=$PWD
d=$(mktemp -d) && ln -s "$repo/node_modules" "$d/node_modules"
mkdir -p "$d/dep" "$d/.cursor"
printf 'name: mcp-dep\nversion: 0.0.1\ndependencies:\n  mcp:\n    - name: dep-server\n      type: stdio\n      command: echo\n' > "$d/dep/apm.yml"
printf 'name: root\nversion: 0.0.1\ntarget: cursor\nexecutables:\n  allow: {}\ndependencies:\n  apm:\n    - path: ./dep\n' > "$d/bapm.yml"
(cd "$d" && node "$repo/packages/cli/dist/cli.mjs" install --target cursor); echo "exit=$?"
```

Ожидание: пустой `allow` не должен валить install без явного deny.  
Факт: `exit 1`, `MCP withheld: unapproved dependency executables (mcp-dep)`; после `approve mcp-dep` любой второй dependency MCP снова валит install.

## Вариации

1. Grant только точечный: один allow не трогает остальные пакеты (они остаются skipped).
2. Grant surface on ⇒ все MCP-пакеты must decide (текущее).
3. `--trust-transitive-mcp` без grant — ставит все dependency MCP, не включая лестницу withhold так же жёстко.

## Рекомендация

Оставить правило deny-wins (вариант 2) для безопасности, но разделить «явно разрешён» и «ещё не решён»: unapproved пакет без deny должен давать warning + skip, а не фатальный отказ всего install; фатальным оставить только org deny/deny_all и project deny. Как минимум — сообщение должно перечислять новые пакеты и предлагать одну команду `bapm approve` для каждого. Оценка M (1–3 дня): изменение `withholdFatal`, тесты и docs.

Критерии закрытия:

- [ ] новый dependency MCP не валит install, если остальные пакеты уже разрешены (или поведение явно задокументировано как fail-closed);
- [ ] `withholdFatal` не срабатывает от пустого `executables: {}` без deny;
- [ ] тест: два dep MCP, разрешён один → второй withheld, install не падает;
- [ ] docs и спека описывают выбранную семантику.

## Поведение сейчас

Первый `bapm approve foo` «ломает» следующий install, пока не разрешат или не запретят остальные пакеты из сообщения. Прямые серверы корня по-прежнему без grant. Ошибка видна и не молчит, но лечится только перебором всех dependency MCP.

## Связанные

- [policy-file-deny-only.md](./policy-file-deny-only.md) — где живёт allow и почему policy не помогает.
- [deny-does-not-undeploy.md](./deny-does-not-undeploy.md) — что делает `deny` после install.
- Второй агент теперь получает MCP (multi-target исправлен); grant-поверхность остаётся общей для всех пакетов.
- [policy-hooks-ungated.md](./policy-hooks-ungated.md) — hook не входит в эту лестницу.
