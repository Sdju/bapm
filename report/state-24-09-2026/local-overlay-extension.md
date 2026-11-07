# `bapm.local.yml` и источник `local`

**Статус:** намеренно  
**Класс:** намеренное отличие

## Суть

Личный оверлей и личные пакеты есть только в bapm. В APM и OpenAPM их нет. Переносимый аналог — `path:`.

## Состояние

| Источник     | Позиция                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------- |
| APM          | Нет `*.local.yml`, нет источника `local`.                                                    |
| OpenAPM      | Нет этих полей.                                                                              |
| Спека bapm   | `manifest-local-overlay`: allowlist `active`, `target`, `targets`, `env`, `registries`.      |
| Код bapm     | `packages/core/src/modules/Manifest/localOverlay.ts`; lock пишется в `bapm.local.lock.yaml`. |
| Документация | `guide/manifest-overlay.md`, ситуации team-local / personal-local.                           |

## Вариации

1. Не вводить расширение — только `path:` в общем манифесте.
2. Личный слой (текущий выбор): не коммитить `bapm.local.yml` / `bapm.local.lock.yaml`.
3. Слить local в общий lock — сломает CI, если машины разные.

## Поведение сейчас

Оверлей полностью заменяет `active` базы, не дополняет. `local`-пакет попадает только в local-lock. Если его записать в общий `bapm.yml`, frozen CI упадёт: пина в общем lock нет. См. [path-absolute-in-lock.md](./path-absolute-in-lock.md) про другой непереносимый путь.
