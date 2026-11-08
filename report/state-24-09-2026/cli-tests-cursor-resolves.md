# Пять CLI-тестов ждут, что канонические интеграции не резолвятся

**Статус:** открыто  
**Класс:** тест  
**Важность:** средняя — пять тестов стабильно красные в dev-дереве, но это ошибка ожиданий теста, а не runtime; маскирует реальные регрессии fail-closed.  
**Проверено:** 08-11-2026, working tree

## Суть

Тесты object-map / marketplace ожидают fail-closed: без `targets:` canonical-хост считается «не встроенным», и `install`/`compile`/`pack` должны завершиться ошибкой. В этом workspace канонические пакеты находятся: `@b-apm/integration-cursor` и `@b-apm/integration-claude` — workspace/devDependencies CLI.

Причина не в CLI fallback (он для canonical явно отключён — `allowCliFallback: false`), а в окружении теста: `vp test` выставляет `NODE_PATH` на `<repo>/node_modules/.pnpm/node_modules`, где лежат hoisted-ссылки workspace-пакетов. `createRequire(<tmp>/package.json).resolve('@b-apm/integration-cursor')` поэтому возвращает `packages/integration-cursor/dist/index.mjs`, и установка/компиляция проходят с exit 0.

Исходная карточка называла пять Cursor-тестов и пути без префикса `packages/cli/`. Сейчас падают пять тестов в четырёх файлах: четыре про Cursor, один про Claude. Пути исправлены ниже.

## Влияние

- **Сценарий:** `pnpm test` в свежем клоне монорепо; пять красных тестов без изменения кода.
- **Кого задевает:** разработчик CLI, CI, агент, который чинит «регрессию» установки.
- **Последствие:** красный suite; ложная диагностика; тесты перестают защищать реальный fail-closed для неизвестных/неустановленных хостов.
- **Частота:** каждый запуск `packages/cli` тестов в монорепо; в опубликованном пакете (без workspace `NODE_PATH`) поведение другое.
- **Обходной путь:** запускать с очищенным `NODE_PATH` или изолировать module resolution в тестах.

## Состояние

| Источник     | Позиция                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | Не применимо.                                                                                                                                                   |
| OpenAPM      | Хосты не bundled в CLI.                                                                                                                                         |
| Спека bapm   | Registry стартует пустым; канонический `@b-apm/integration-<id>` резолвится из проекта/global, но не из CLI fallback.                                           |
| Код bapm     | `canonicalHosts.ts` знает 11 canonical id; `loadManifestIntegrations.ts` резолвит из cwd/global и фильтрует workspace roots только в `globalPaths`.             |
| Тесты        | Ожидают `not.toBe(0)` для `cursor`/`claude` без `targets:`; в dev-дереве получают `0`.                                                                          |
| Документация | Help: CLI не содержит built-in Cursor; интеграции подгружаются пакетами.                                                                                        |

## Проверка

| Артефакт | Где смотреть                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/cli/src/common/canonicalHosts.ts:10-24` — `CANONICAL_HOST_IDS` включает `cursor`, `claude`.                     |
| Код      | `packages/cli/src/modules/Integrations/loadManifestIntegrations.ts:112-115` — `createRequire(join(cwd, "package.json")).resolve(specifier)`; `:352` — canonical с `allowCliFallback: false`; `:119` фильтрует только `globalPaths`. |
| Тесты    | `packages/cli/tests/integrations/map-load-compile.test.ts:67` — compile cursor; `map-load-install.test.ts:71`, `:114`; `map-load-fail-closed.test.ts:109`; `pack/marketplace-on-demand.test.ts:23` (Claude). |
| Пакет    | `packages/cli/package.json:46-47` — `@b-apm/integration-cursor` в devDependencies.                                        |

Воспроизведение:

```bash
cd packages/cli
../../node_modules/.bin/vp test run tests/integrations/map-load-{compile,fail-closed,install}.test.ts tests/pack/marketplace-on-demand.test.ts
```

Ожидание: все тесты зелёные — canonical-пакеты не видны из tmp-проекта.  
Факт: `5 failed | 9 passed (14)`; падают `compile --target cursor without object-map`, `cursor without object-map`, `legacy string target…`, `unknown forced id diagnostic hints…`, `pack selecting Claude…`.

## Вариации

1. Изолировать module resolution в тестах: чистить `NODE_PATH` и/или передавать `globalRoots: []` + seam для canonical resolve — рекомендуется.
2. Принять canonical resolve в dev-дереве и переписать ожидания (проверять реальный материал/файлы, а не exit) — тесты перестанут проверять fail-closed.
3. Не грузить canonical из монорепо при test — сломает другие кейсы, где cursor ожидается доступным.

## Рекомендация

Вариант 1. В тестовом helper для `runInProject` сохранять/очищать `NODE_PATH` (и, если нужно, `npm_config_*`), а canonical resolve в тестах ограничивать пустым `globalRoots`; добавить отдельный кейс «canonical резолвится из global root» с явным портом. Оценка S/M (полдня — день).

Критерии закрытия:

- [ ] Пять тестов зелёные при запуске из монорепо.
- [ ] Отдельный тест доказывает resolve canonical из global root.
- [ ] Fail-closed для неизвестного id остаётся покрытым.

## Поведение сейчас

Падают:

- `packages/cli/tests/integrations/map-load-compile.test.ts`
- `packages/cli/tests/integrations/map-load-fail-closed.test.ts` (кейс с подсказкой `targets:`)
- `packages/cli/tests/integrations/map-load-install.test.ts` (два кейса)
- `packages/cli/tests/pack/marketplace-on-demand.test.ts` (Claude)

Это не регрессия `fix-install-safety` / help. Причина: canonical-пакет находится через `NODE_PATH`, хотя тест считает хост unknown. В исходной карточке было «пять Cursor-тестов» — фактически четыре Cursor и один Claude.

## Связанные

- [tests-home-isolation.md](./tests-home-isolation.md) — другой источник машинозависимых тестов.
- [stale-specs-compile-and-cursor.md](./stale-specs-compile-and-cursor.md) — спека, которая ещё описывает cursor-only срез.
