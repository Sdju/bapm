# Registry: клиент за флагом, сервер не заявлен

**Статус:** намеренно (неполная роль)  
**Класс:** намеренное отличие  
**Важность:** низкая — роль Registry честно не заявлена, клиент работает по явному флагу и падает закрыто; неудобство ограничено экспериментальным сценарием.  
**Проверено:** 08-11-2026, working tree

## Суть

OpenAPM описывает Registry как отдельный класс: хост, который хранит и раздаёт пакеты. APM использует registry как клиент в обычном install/publish. bapm заявляет только роли Consumer, Producer и Governance; `req-rg-001` имеет статус `n/a`, сервер registry не реализован. Клиентская часть при этом есть: `createRegistryClient` умеет list / download / publish.

Чтобы экспериментальный клиент не срабатывал случайно, resolve/install и publish закрыты общим гейтом `BAPM_EXPERIMENTAL_REGISTRIES` (`packages/core/src/modules/Registry/gate.ts:7`). Гейт включает опция `{ experimentalRegistries: true }` или env со значением `1`, `true`, `yes` (`gate.ts:13-16`). Без него резолвер не вызывает registry-путь: он бросает `RESOLVE_REGISTRY_DEFERRED` и явно пишет «not falling back to git» (`packages/core/src/modules/Resolver/resolveGraph.ts:236-241`). Publish отдельно вызывает `assertExperimentalRegistriesEnabled({ action: "publish" })` и падает с `REGISTRY_GATE`.

Смысл такой схемы — не выдавать экспериментальную сетевую функцию за стабильную и не публиковать архив случайно. Цена — пользователь APM, привыкший, что `id` + registry ставится сразу, получает отказ, пока не выставит env. Роль «bapm как registry-сервер» не реализуется и не заявляется ни в спеке, ни в docs.

## Влияние

- **Сценарий:** манифест с `registries:` и зависимостью `id: contoso/demo`; `bapm install` запускают без `BAPM_EXPERIMENTAL_REGISTRIES`.
- **Кого задевает:** команды с приватным registry, мигранты с APM, CI, где env забыли добавить.
- **Последствие:** install завершается ошибкой до сети; молчаливого git-fallback нет. Publish также не уйдёт без флага.
- **Частота:** каждое registry-действие, пока флаг не выставлен; в обычных git-проектах не встречается.
- **Обходной путь:** `BAPM_EXPERIMENTAL_REGISTRIES=1` в окружении (в CI — через секреты/переменные), либо оставаться на git/`path`.

## Состояние

| Источник     | Позиция                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| APM          | Клиент registry в обычном install/publish.                                                                             |
| OpenAPM      | Класс Registry (`req-rg-001`) — отдельная роль.                                                                        |
| Спека bapm   | `CONFORMANCE.md:23,145`: Registry = `n/a`, host не заявлен.                                                            |
| Код bapm     | `Registry/gate.ts:9` — гейт; `Resolver/resolveGraph.ts:236` — отказ без флага; клиент — `Registry/createClient.ts:19`. |
| Тесты        | `packages/core/tests/registry/resolve-install.test.ts` — только gate-on; отдельного gate-off теста нет.                |
| Документация | `apps/docs/guide/conformance.md:26`; `apps/docs/guide/manifest-registries.md:8`.                                       |

## Проверка

| Артефакт | Где смотреть                                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `Registry/gate.ts:7` — имя env; `:13-16` — значения; `:23-34` — `REGISTRY_GATE`; `Resolver/resolveGraph.ts:236-241` — `RESOLVE_REGISTRY_DEFERRED`.    |
| Тесты    | `resolve-install.test.ts:43` — happy path под флагом; `:205` — недоступный registry не падает в git; `helpers.ts:485` — `withExperimentalRegistries`. |
| Спека    | `CONFORMANCE.md:23,145`; `tests/spec-conformance/checklist.yml` — `req-rg-001` `n/a`.                                                                 |
| Docs     | `apps/docs/guide/manifest-registries.md:8` — флаг обязателен для install и publish; `conformance.md:26`.                                              |

Воспроизведение:

```bash
repo=$PWD; tmp=$(mktemp -d)
cat > "$tmp/bapm.yml" <<'YAML'
name: demo
version: 0.0.1
registries: { primary: { url: "https://registry.example.com" }, default: primary }
dependencies: { apm: [{ id: contoso/demo, version: "^1.0.0" }] }
YAML
(cd "$tmp" && env -u BAPM_EXPERIMENTAL_REGISTRIES node "$repo/packages/cli/dist/cli.mjs" install)
```

Ожидание: отказ до сетевого запроса, код выхода 1.  
Факт: `bapm: Registry dependency resolve is experimental/deferred until enabled (id=contoso/demo). Set BAPM_EXPERIMENTAL_REGISTRIES=1 ... — not falling back to git`; воспроизведено 08.11.2026.

## Вариации

1. Полный registry-сервер — вне scope и вне заявленных ролей; плюс — полнота OpenAPM, минус — большой продукт.
2. Клиент всегда включён, как в APM; плюс — привычное поведение, минус — случайные сетевые запросы/publication и расхождение с заявлением `n/a`.
3. Клиент только с флагом (текущий выбор); **рекомендуется** — эксперимент явно opt-in, отказ закрытый.

## Рекомендация

Оставить вариант 3. Роль Registry не заявлена осознанно, а гейт защищает от случайной сети и публикации. Оценка S: добавить тест на выключенный гейт (сейчас проверен только путь с `withExperimentalRegistries`), затем закрыть карточку.

Критерии закрытия:

- [ ] вариант 3 подтверждён владельцем;
- [ ] есть тест: без `BAPM_EXPERIMENTAL_REGISTRIES` resolve даёт `RESOLVE_REGISTRY_DEFERRED` и не ходит в сеть/git;
- [ ] `Registry` остаётся `n/a` в `CONFORMANCE.md`, docs называют флаг для install и publish.

## Поведение сейчас

Без `BAPM_EXPERIMENTAL_REGISTRIES=1` зависимость `id` + registry не ставится и не превращается в git-пакет: install завершается кодом 1 с remediation-строкой. С флагом клиент выполняет list/download, а lock получает `source: registry`, `resolved_url` и `resolved_hash`. Publish без флага также отвергается. Роль «bapm как registry-сервер» не реализуется и не заявляется.

## Связанные

- [openapm-8-5-layout.md](./openapm-8-5-layout.md) — ещё одна роль/требование OpenAPM, которое bapm честно не заявляет.
