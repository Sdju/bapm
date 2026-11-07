# Приоритет `env`: overlay vs bake

**Статус:** открыто в main-спеках / закрывается change  
**Класс:** долг спеки (код согласован)

## Суть

`manifest-local-overlay` говорит: env-overrides процесса — самый слабый слой. `mcp-env-bake` говорит: для `${VAR}` непустое значение процесса побеждает карту `env` манифеста. Это разные фразы про «env».

## Состояние

| Источник     | Позиция                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| APM          | Bake MCP: process env, затем манифест.                                                                                  |
| OpenAPM      | Placeholder resolution: process, затем project env map.                                                                 |
| Спека bapm   | Overlay: CLI > local yml > base yml > process-env overrides. Bake: overrides map > process env > merged manifest `env`. |
| Код bapm     | Overlay мержит `bapm.local.yml` `env` поверх base. Bake читает `process.env` раньше merged `env`.                       |
| Документация | `guide/config-manifest.md` / overlay: local env бьёт base; для MCP placeholders — process.                              |

## Вариации

1. Оставить два правила: «настройки CLI» vs «подстановка секретов MCP» (код + docs).
2. Один порядок на всё — сломает либо bake, либо overlay.
3. Починить формулировку overlay (change `sync-specs-with-shipped-behavior`).

## Поведение сейчас

`API_TOKEN=proc` + `env.API_TOKEN: base` в yml + `local` в overlay → в MCP попадёт `proc`. Без переменной процесса — значение overlay, затем base. Main-спека overlay ещё без этого исключения, пока change не смержен в `openspec/specs`.
