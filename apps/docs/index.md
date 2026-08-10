# bapm

**Better Agent Package Manager** управляет зависимостями для конфигурации AI-агентов. Объявите пакеты в `bapm.yml`, запустите `bapm install`, и CLI зафиксирует граф в lock-файле и разложит skills, rules, agents и MCP в layout выбранного host.

Репозиторий: [github.com/Sdju/bapm](https://github.com/Sdju/bapm)

::: warning UNSTABLE
Ранний публичный релиз на npm. API и on-disk layout могут меняться без major bump. **Не для production.**
:::

::: warning AI-migrated rewrite
bapm — переписывание [microsoft/apm](https://github.com/microsoft/apm). Большая часть кода и документации перенесена с помощью AI и **пока недостаточно ревьюирована** для production.
:::

## Начните с задачи

| Нужно сделать                       | Откройте                                       |
| ----------------------------------- | ---------------------------------------------- |
| Первый install в проекте            | [Быстрый старт](/guide/quick-start)            |
| Выбрать или сменить host            | [Поддерживаемые hosts](/guide/supported-hosts) |
| Понять detect, `active` и `targets` | [Как выбирается host](/guide/host-selection)   |
| Настроить манифест                  | [Манифест `bapm.yml`](/guide/config-manifest)  |
| Работать в команде, CI или с policy | [Сценарии](/guide/situations/)                 |
| Найти флаг команды                  | [Справка](/reference/)                         |

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

У известных hosts CLI может разрешить стандартный пакет `@b-apm/integration-<id>` без object-map `targets:`. Map нужен, когда вы подменяете пакет или добавляете собственный host. Возможности hosts различаются: сверяйтесь с [таблицей поддерживаемых hosts](/guide/supported-hosts).

## Связанные проекты

- [microsoft/apm](https://github.com/microsoft/apm) — исходный APM
- [Agent Plugins](https://github.com/Sdju/agent-plugins) — runtime/плагины; см. [guide/agent-plugins](/guide/agent-plugins)
