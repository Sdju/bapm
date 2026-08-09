# bapm

**Better Agent Package Manager** — ставит и обновляет пакеты для AI-агентов так же предсказуемо, как обычный менеджер зависимостей ставит библиотеки кода.

```bash
npm i -g @bapm/cli @bapm/integration-cursor
# в проекте с .cursor/ и bapm.yml:
bapm install
```

Вы описываете skills, инструкции, агенты и MCP. bapm разрешает зависимости, фиксирует версии в lock и раскладывает их туда, где подхватит агент. Для Cursor достаточно установленного `@bapm/integration-cursor` и detect — object-map `targets:` не обязателен ([быстрый старт](/guide/quick-start)).

[Перейти к быстрому старту →](/guide/quick-start)

## Зачем это

Без менеджера зависимости агента копируют руками и надеются, что у коллеги получится так же. bapm даёт общий манифест, воспроизводимую установку и понятные команды обновления и проверки.

## С чего начать

1. [Быстрый старт](/guide/quick-start) — CLI, пакет интеграции, первый `install`
2. [Как выбирается host](/guide/host-selection) — precedence и canonical fallback
3. [Поддерживаемые hosts](/guide/supported-hosts) — таблица пакетов и Advanced targets
4. [Сценарии](/guide/situations/) — CI, команда с разными агентами, политика

Флаги: [справка](/reference/).
