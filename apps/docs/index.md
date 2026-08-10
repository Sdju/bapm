# bapm

**Better Agent Package Manager** — менеджер зависимостей для конфигурации AI-агентов: объявляете пакеты в `bapm.yml`, `bapm install` разрешает граф, пишет lock и раскладывает skills, rules, agents и MCP туда, где их подхватит агент. Воспринимайте его как npm / pip для вашего агента.

::: warning UNSTABLE
Ранний публичный релиз на npm. API и on-disk layout могут меняться без major bump. **Не для production.**
:::

::: warning AI-migrated rewrite
bapm — переписывание [microsoft/apm](https://github.com/microsoft/apm). Большая часть кода и документации перенесена с помощью AI и **пока недостаточно ревьюирована** для production.
:::

## Зачем?

- Легко и быстро ставить зависимости для агента
- Подключать корпоративные модули из private registry (**experimental**, нужна переменная `BAPM_EXPERIMENTAL_REGISTRIES=1`)
- Разделять возможности агента для всей команды и личные (`bapm.yml` + `bapm.local.yml`)
- Использовать разные агенты на одном проекте и переиспользовать общие MCP / Skills / Instructions
- Общий манифест и lock для hosts; on-disk layout у каждого агента свой
- Настраивать корпоративные политики для агентов в компании

После `bapm install` выбранный host получает поддерживаемые примитивы. То, чего host не умеет, **пропускается с диагностикой** (без тихой «замены» на другой тип). Сводку instructions / skills в markdown даёт отдельно `bapm compile` (например `AGENTS.md` у Cursor).

## Почему не APM?

По сравнению с [microsoft/apm](https://github.com/microsoft/apm):

- Нет привязки к одному агенту — отдельные интеграционные пакеты под ваши нужды
- Можно интегрировать кастомные агенты
- Заточен под командную работу и контроль личных vs командных артефактов
- Более продвинутая модель работы
- **SOON:** кастомные артефакты или паттерны для агентов
- **SOON:** система плагинов для расширения bapm

CLI и host-интеграции ставятся **отдельно**. Для известных hosts достаточно `@b-apm/integration-<id>` — object-map `targets:` не обязателен (canonical fallback). Map — чтобы подменить пакет или добавить свой host. Возможности hosts различаются — см. [поддерживаемые hosts](/guide/supported-hosts).

## Happy path

```bash
npm i -g @b-apm/cli @b-apm/integration-cursor
# в проекте с .cursor/ и bapm.yml:
bapm install
```

Артефакты материализуются в `apm_modules/`, пишется lock; для Cursor skills обычно уходят в `.agents/skills/`, rules / agents / MCP — в `.cursor/`.

[Перейти к быстрому старту →](/guide/quick-start)

## С чего начать

1. [Быстрый старт](/guide/quick-start) — CLI, пакет интеграции, первый `install`
2. [Как выбирается host](/guide/host-selection) — precedence и canonical fallback
3. [Поддерживаемые hosts](/guide/supported-hosts) — таблица пакетов и Advanced targets
4. [Сценарии](/guide/situations/) — CI, команда с разными агентами, политика

Флаги: [справка](/reference/).

## Связанные проекты

- [microsoft/apm](https://github.com/microsoft/apm) — исходный APM
- [Agent Plugins](https://github.com/Sdju/agent-plugins) — runtime/плагины; см. [guide/agent-plugins](/guide/agent-plugins)
