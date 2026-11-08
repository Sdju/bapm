# `deny` не убирает уже записанный сервер

**Статус:** открыто  
**Класс:** продукт  
**Важность:** средняя — запрет останавливает новые deploy, но оставляет рабочий сервер в конфиге агента; пользователь считает, что deny сработал, пока не проверит JSON вручную.  
**Проверено:** 08-11-2026, working tree

## Суть

`bapm deny pkg` пишет `executables.deny` в `~/.bapm/config.json`. Следующий install видит deny, не включает сервер в approved-набор и завершается ошибкой `MCP withheld: unapproved dependency executables`. Однако конфиг агента при этом не переписывается: если сервер уже лежал в `.cursor/mcp.json`, он остаётся.
Причина в двух местах. Если approved-набор пуст, `deployMcpAfterPolicy` делает early return до `configureMcp`, поэтому файл хоста не трогается. Если другие серверы approved, `configureMcp` читает существующий JSON и мержит новые записи, не удаляя старые. Так же ведут себя Claude, Gemini, Kiro, Antigravity и home-хосты Copilot/Windsurf.

Это осознанное ограничение модели: deny — user-local решение, а не команда очистки host JSON. Спека требует withhold на install и не требует синхронного удаления. Но UX-обещание «запретил пакет» не совпадает с фактическим «запретил будущие записи».

## Влияние

- **Сценарий:** сервер уже стоял, пользователь выполнил `bapm deny pkg`, перезапустил install и увидел ошибку про withhold; сервер продолжает работать в агенте.
- **Кого задевает:** безопасность, пользователь, который думает, что отозвал доступ.
- **Последствие:** stale-запись в `.cursor/mcp.json` (или другом host-файле) с прежним command/url/env; секреты и доступ сохраняются.
- **Частота:** каждый deny после успешного install; особенно заметно при инциденте/отзыве доступа.
- **Обходной путь:** вручную удалить сервер из конфига агента; либо удалить файл и выполнить install заново. Автоматической команды prune нет.

## Состояние

| Источник       | Позиция                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| APM            | Интерактивный deny ближе к «больше не предлагать»; уже записанный конфиг хоста часто остаётся.                  |
| OpenAPM sc-010 | Deny — user-local, не обязан патчить host JSON.                                                                 |
| Спека bapm     | Install withhold; нет требования синхронно вычищать конфиг.                                                     |
| Код bapm       | `runDeny` пишет user store. `configureMcp` мержит existing JSON; при пустом approved — early return без записи. |
| Тесты          | `approve-deny.test.ts:45` проверяет запись deny, но не удаление из host-конфига.                                |
| Документация   | `policy-mcp.md:50`: «удалите его оттуда вручную».                                                               |

## Проверка

| Артефакт | Где смотреть                                                                                                                                                                                                                                                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/cli/src/modules/Deny/services/runDeny.ts:59` — persist `grant: "deny"`; `packages/core/src/modules/ExecutableTrust/userStore.ts:156` — запись в `executables.deny`; `packages/integration-cursor/src/createCursorIntegration.ts:190` — merge без удаления; `packages/core/src/modules/Install/runInstall.ts:918` — early return при `approved.length === 0`. |
| Тесты    | `packages/cli/tests/mcp/approve-deny.test.ts:45` — deny попадает в user store; теста на очистку `.cursor/mcp.json` нет.                                                                                                                                                                                                                                                |
| Спека    | `openspec/specs/executable-mcp-trust/spec.md:23` — withhold при unapproved; удаление host-записи не требуется.                                                                                                                                                                                                                                                         |
| Docs     | `apps/docs/guide/situations/policy-mcp.md:50` — ручное удаление.                                                                                                                                                                                                                                                                                                       |

Воспроизведение:

```bash
repo=$PWD
d=$(mktemp -d) && home=$(mktemp -d) && ln -s "$repo/node_modules" "$d/node_modules"
mkdir -p "$d/dep" "$d/.cursor"
printf 'name: mcp-dep\nversion: 0.0.1\ndependencies:\n  mcp:\n    - name: dep-server\n      type: stdio\n      command: echo\n' > "$d/dep/apm.yml"
printf 'name: root\nversion: 0.0.1\ntarget: cursor\nexecutables:\n  allow:\n    mcp-dep: { mcp: true }\ndependencies:\n  apm:\n    - path: ./dep\n' > "$d/bapm.yml"
cd "$d"
HOME="$home" node "$repo/packages/cli/dist/cli.mjs" install --target cursor
HOME="$home" node "$repo/packages/cli/dist/cli.mjs" deny mcp-dep
HOME="$home" node "$repo/packages/cli/dist/cli.mjs" install --target cursor; echo "exit=$?"
node -e 'console.log(Object.keys(require("./.cursor/mcp.json").mcpServers))'
```

Ожидание: после deny сервер исчезает из конфига агента.  
Факт: install `exit 1` с `MCP withheld...`, но `.cursor/mcp.json` по-прежнему содержит `dep-server`; в `~/.bapm/config.json` лежит `executables.deny`.

## Вариации

1. Переписать конфиг агента без запрещённых серверов.
2. Только не добавлять новые (текущее + ручная чистка).
3. Отдельная команда `bapm mcp prune`.

## Рекомендация

Вариант 1 для известных серверов: при deny (или следующем install) удалять из host JSON записи, которыми владеет bapm и чей пакет запрещён; ownership уже частично есть в lock/inventory. Не трогать чужие записи и не удалять файл целиком. Если это слишком рискованно — вариант 3: `bapm mcp prune` с dry-run и явным списком. Оценка M (1–3 дня) плюс тесты на Cursor/Claude и сохранение посторонних серверов.

Критерии закрытия:

- [ ] после `bapm deny pkg` и успешного/неуспешного install сервер пакета отсутствует в host JSON;
- [ ] посторонние серверы и ключи файла не затрагиваются;
- [ ] поведение одинаково для Cursor, Claude и хотя бы одного home-хоста;
- [ ] docs описывают автоматическую очистку либо остаются с ручным шагом и тестом.

## Поведение сейчас

После deny нужен ручной edit конфига агента. Второй агент теперь тоже конфигурируется (multi-target исправлен), но deny по-прежнему не чистит уже записанный сервер. Lock-inventory может обновиться, а host JSON остаётся источником фактического запуска сервера.

## Связанные
