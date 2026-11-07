# В TTY `bin/` ставится без `--trust-bin`

**Статус:** намеренно  
**Класс:** продукт

## Суть

Non-interactive (CI, `BAPM_NON_INTERACTIVE`, non-TTY, frozen) не деплоит dependency `bin/` без флага или persisted `bin: true`. В интерактивном терминале bin раскладывается с предупреждением. `bapm approve` grant на bin не выдаёт.

## Состояние

| Источник     | Позиция                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| APM          | Consent на исполняемое ближе к интерактивному prompt / policy.                                                              |
| OpenAPM      | Bin — executable type; consent слой — реализация.                                                                           |
| Спека bapm   | `install-trust-bin`: `--trust-bin` / `--no-trust-bin` после deny-wins лестницы. Интерактивный default — отдельный сценарий. |
| Код bapm     | `ExecutableTrust/binConsent.ts` + install.                                                                                  |
| Документация | `reference/install.md`: TTY без флага + warning; approve ≠ bin grant.                                                       |

## Вариации

1. Всегда требовать `--trust-bin` или YAML grant.
2. TTY = implicit consent (текущее).
3. `approve` умеет `bin: true` — не сделано.

## Поведение сейчас

Локальный `bapm install` в терминале может положить `bin/` зависимости, напечатав warning. Тот же install в GitHub Actions без `--trust-bin` и без `executables.allow.*.bin` bin не положит. `--no-trust-bin` побеждает даже allow, org deny побеждает `--trust-bin`.
