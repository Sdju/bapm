# Корневые `targets` молча сужают раскладку

**Статус:** намеренно (правило) / открыто (UX)  
**Класс:** продукт  
**Важность:** высокая — штатный `active`/`--target` даёт `installed for <id>` и ноль файлов без ошибки; пользователь узнаёт о проблеме только по пустому каталогу агента.  
**Проверено:** 08-11-2026, working tree

## Суть

`target` / `targets` в корне манифеста — это не «какие агенты активны», а «на каких агентов вообще разрешено класть файлы». `active` и `--target` выбирают хост, после чего `filterByIntersection` строит `consumerAuth` из declared ids и при несовпадении возвращает пустой список: `if (!consumerAuth.has(activeTargetId)) return []` (`packages/core/src/modules/Install/runInstall.ts:1671-1680`). Дальше вызывается `materialize` с пустым набором (`:427-445`), и команда завершается успешно.

Правило закреплено в `install-pipeline:176` (intersection active ∩ consumer-authorized ∩ package-declared) и в сценарии `:573` (active ids материализуются с учётом intersection). OpenAPM tg-008 требует того же. Объект-карта `targets` дополнительно регистрирует пакеты интеграций: CLI загружает значения карты до выбора active (`target-integration-dynamic-load`), поэтому удалить блок «просто так» нельзя, если там custom-интеграция.

Проблема в коммуникации: вывод `bapm: installed for claude` (`packages/cli/src/modules/Install/services/runInstall.ts:577`) формируется из `activeTargets`, а не из фактически разложенных примитивов. Пользователь видит успех и пустой `.claude/`. Docs предупреждают (`apps/docs/guide/host-selection.md:45-46,57`), но warning спрятан в guide, а не в выводе команды.

## Влияние

- **Сценарий:** в манифесте остался `targets: { cursor: "@b-apm/integration-cursor" }` после `init --target cursor`; коллега запускает `bapm install --target claude` или добавляет `claude` в `active`.
- **Кого задевает:** команды с разными агентами; новички после `init`; CI, где проверяется наличие файлов.
- **Последствие:** Claude (или другой незадекларированный id) получает `installed for claude` и ни одного файла; MCP-контур при этом тоже может отработать для первого target'а, маскируя проблему.
- **Частота:** каждый install, где active/--target не входит в declared ids; типично после init и при смене агента.
- **Обходной путь:** удалить `target`/`targets` из корня или перечислить в нём всех используемых агентов; для custom-интеграций оставить только нужные ключи.

## Состояние

| Источник       | Позиция                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APM            | Предпочтение хоста ближе к одному полю; intersection в том же виде не выделен.                                                                             |
| OpenAPM tg-008 | Нельзя одновременно `target` и `targets`. Intersection active ∩ declared ∩ package targets.                                                                |
| Спека bapm     | `install-pipeline:176` — declared ids из `target`/`targets`; `:573` — active материализуется с учётом intersection; `:593` — MCP для каждого активного id. |
| Код bapm       | `runInstall.ts:1671-1680`: при отсутствии active в declared ids возвращается `[]`; `:427-445` — materialize с пустым списком; ошибки нет.                  |
| Документация   | `guide/host-selection.md:45-46` — warning; `:57` — «installed for <id>, но файлов нет».                                                                    |

## Проверка

| Артефакт | Где смотреть                                                                                                                                                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Install/runInstall.ts:1678-1680` — `consumerAuth` и пустой результат при несовпадении.                                                                                                                                         |
| Код      | `packages/core/src/modules/Install/targets.ts:13-32` — `declaredTargetIds` читает `target`, `targets`, object-map keys.                                                                                                                                   |
| Тесты    | `packages/core/tests/install/target-wire.test.ts:28` — package-level intersection; `packages/cli/tests/install/active-selection.test.ts:51-53` — оба id объявлены, «so intersection does not empty-filter». Теста на warning при пустом intersection нет. |
| Спека    | `openspec/specs/install-pipeline/spec.md:176,573` — intersection declared ids.                                                                                                                                                                            |
| Docs     | `apps/docs/guide/host-selection.md:45-46` — блок ограничивает раскладку.                                                                                                                                                                                  |

Воспроизведение:

```bash
mkdir bapm-narrow && cd bapm-narrow
printf 'name: bapm-narrow\nversion: 0.1.0\ndependencies:\n  apm:\n    - path: ./pkg\n' > bapm.yml
printf 'targets:\n  cursor: "@b-apm/integration-cursor"\n' >> bapm.yml
mkdir -p pkg .claude
printf 'name: pkg\nversion: 0.1.0\ndependencies:\n  apm: []\n' > pkg/bapm.yml
mkdir -p pkg/skills/hello
printf '%s\n' '---' 'name: hello' '---' '# Hello' > pkg/skills/hello/SKILL.md
npm i -D @b-apm/integration-cursor @b-apm/integration-claude
bapm install --target claude
find .claude -type f
```

Ожидание: ошибка о том, что `claude` не разрешён в `targets`, либо файлы в `.claude/`.  
Факт: `bapm: installed for claude`, `.claude` пуст (проверено 08-11-2026).

## Вариации

1. Считать `targets` только регистрацией интеграций, не фильтром — ломает OpenAPM tg-008 и текущую спеку.
2. Фильтровать и падать, если active не пересекается с declared (рекомендуется для UX) — явная ошибка вместо пустого каталога; warning как минимум.
3. Фильтровать и печатать успех (текущее) — пользователь видит `installed for claude` и пустой `.claude/`.

## Рекомендация

Оставить вариант 2 в мягкой форме: при пустом intersection печатать warning с id и списком declared, а `installed for <id>` заменить на фактически получившие файлы хосты. Полный fail-closed — обсудить отдельно, потому что пакетные `targets` (subset зависимости) тоже дают пустой результат и это может быть законным. Оценка S–M: diagnostic в core/CLI, тест на пустой intersection, правка docs.

Критерии закрытия:

- [ ] при `targets: {cursor}` + `--target claude` есть warning/ошибка с обоими id.
- [ ] итоговый вывод не утверждает `installed for claude` без файлов.
- [ ] тест фиксирует пустой intersection и сообщение; docs совпадают.

## Поведение сейчас

`targets: { cursor: "@b-apm/integration-cursor" }` + `--target claude` (claude зарегистрирован каноническим пакетом) не кладёт файлы в Claude и не печатает предупреждения. Карта `targets` ещё и регистрирует пакеты интеграций, поэтому «удалить блок» не всегда безопасно для custom id. `active` не расширяет declared ids; `--target` тоже не расширяет. `init --target` больше не пишет сужающий блок (исправлено).

## Связанные

- Сужающий блок больше не создаётся командой `init --target` (исправлено).
- MCP теперь пишется всем active-хостам (исправлено).
- [stale-specs-compile-and-cursor.md](./stale-specs-compile-and-cursor.md) — спеки про выбор cursor/active.
