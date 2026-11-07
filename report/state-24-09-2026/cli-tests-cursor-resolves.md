# Пять CLI-тестов ждут, что Cursor не резолвится

**Статус:** открыто  
**Класс:** тест

## Суть

Тесты object-map / marketplace ожидают fail-closed: без `targets:` Cursor и Claude «не встроены». В этом workspace Cursor резолвится даже из пустого `/tmp` проекта. Claude — нет. Пять тестов красные и на базе, и после правок help.

## Состояние

| Источник     | Позиция                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | Не применимо.                                                                                                                                                   |
| OpenAPM      | Хосты не bundled в CLI.                                                                                                                                         |
| Спека bapm   | Registry стартует пустым; канонический `@b-apm/integration-<id>` резолвится из node_modules / global.                                                           |
| Код bapm     | `packages/cli/src/common/canonicalHosts.ts` пытается загрузить канонический пакет. В монорепо `@b-apm/integration-cursor` доступен как workspace/devDependency. |
| Документация | Help: CLI не содержит built-in Cursor.                                                                                                                          |

## Вариации

1. Тесты изолируют module resolution (нет доступа к workspace cursor).
2. Тесты принимают канонический resolve в dev-дереве.
3. Не грузить канонические пакеты из монорепо при test — сломает другие кейсы.

## Поведение сейчас

Падают:

- `tests/integrations/map-load-compile.test.ts`
- `tests/integrations/map-load-fail-closed.test.ts`
- `tests/integrations/map-load-install.test.ts` (два кейса)
- `tests/pack/marketplace-on-demand.test.ts`

Это не регрессия `fix-install-safety` / help. Причина: Cursor находится, хотя тест считает его unknown.
