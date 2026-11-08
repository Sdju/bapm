# Манифест `bapm.yml`

`bapm.yml` лежит в корне проекта и описывает, какие пакеты и MCP-серверы нужны агенту. Файл коммитится в git и общий для всей команды.

bapm ищет манифест только в текущем каталоге. Вместо `bapm.yml` можно использовать `apm.yml` из microsoft/apm; если лежат оба файла, команды завершаются ошибкой — оставьте один.

## Пример

```yaml
name: my-project
version: 0.1.0

dependencies:
  apm:
    - acme/agent-skills#v1.2.0
    - path: ./tools/team-skills
  mcp:
    - name: github
      registry: false
      transport: stdio
      command: npx
      args: ["-y", "@modelcontextprotocol/server-github"]
      env:
        GITHUB_TOKEN: "${GITHUB_TOKEN}"

active:
  target: cursor
```

Создать заготовку: `bapm init -y --target cursor`.

## Поля

| Поле              | Обязательно | Зачем                                                                                                                                |
| ----------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `name`, `version` | да          | Имя и версия проекта                                                                                                                 |
| `dependencies`    | нет         | `apm` — пакеты агента, `mcp` — MCP-серверы. [Формы записи](/guide/manifest-dependencies)                                             |
| `devDependencies` | нет         | То же, что `dependencies`; сюда пишет `bapm install --dev <ref>`                                                                     |
| `active`          | нет         | Какого агента и какие пресеты использовать. [Подробнее](/guide/manifest-hosts#active)                                                |
| `presets`         | нет         | Именованные наборы зависимостей, см. ниже                                                                                            |
| `env`             | нет         | Значения по умолчанию для переменных в MCP-конфигах, см. ниже                                                                        |
| `targets`         | нет         | Своя интеграция агента; заодно ограничивает, каким агентам раскладываются файлы. [Подробнее](/guide/manifest-hosts#targets-и-target) |
| `executables`     | нет         | Разрешения для MCP и `bin/` из зависимостей для всей команды. [Подробнее](/guide/situations/policy-mcp)                              |
| `lifecycle`       | нет         | Сохраняется, но **не исполняется**: install печатает `LIFECYCLE_UNSUPPORTED`. См. [install](/reference/install)                       |
| `registries`      | нет         | Приватные registry (экспериментально). [Подробнее](/guide/manifest-registries)                                                       |
| `marketplace`     | нет         | Описание маркетплейса для `bapm pack`. [Подробнее](/guide/manifest-registries#marketplace)                                           |

Личные настройки, которые не должны попадать в git (ваш агент, ваши значения переменных), кладите в [`bapm.local.yml`](/guide/manifest-overlay).

## Пресеты

Пресет — именованный набор зависимостей, который ставится, только если его включили. Удобно, когда части команды нужны дополнительные skills: например, аналитикам — skills для работы с данными, а разработчикам — для ревью кода.

```yaml
dependencies:
  apm:
    - acme/base-skills # ставится всем

presets:
  - name: developer
    dependencies:
      apm:
        - acme/code-review-skills
  - name: analyst
    dependencies:
      apm:
        - acme/data-skills

active:
  target: cursor
  preset: developer # пресет по умолчанию для проекта
```

Каждый выбирает свой пресет в личном `bapm.local.yml`:

```yaml
active:
  target: cursor
  preset: analyst
```

Пресеты объявляются только в `bapm.yml`; в `bapm.local.yml` их можно выбирать, но не объявлять. Кроме `dependencies`, пресет может содержать `devDependencies` и собственный `active`, который включает другие пресеты или агентов.

::: warning Файлы выключенного пресета остаются на диске
Если выключить пресет или вручную убрать пакет из манифеста, `bapm install` перестанет его ставить. Обычный (не-frozen) install удалит файлы, записанные за пакетом в `deployed_file_hashes` предыдущего lock; без inventory или в `--frozen` (включая CI-default) они останутся. Пустые каталоги не удаляются. `bapm prune` убирает только каталоги в `apm_modules/`; оставшиеся файлы удалите вручную.
:::

## Переменные для MCP: `env`

MCP-серверам часто нужны токены и адреса. В манифесте их пишут как `${VAR}`, а значение берётся при `install`:

1. из переменной окружения процесса;
2. если её нет — из `env` в `bapm.local.yml`;
3. если нет и там — из `env` в `bapm.yml`.

Если значение не нашлось нигде, install завершается ошибкой `MCP env bake failed`.

```yaml
# bapm.yml — значения по умолчанию, без секретов
env:
  GITHUB_API_URL: "https://api.github.com"
```

```yaml
# bapm.local.yml — личные значения, не в git
env:
  GITHUB_TOKEN: "ghp_…"
```

Не кладите секреты в `env` файла `bapm.yml`: он в git. Как значения попадают в конфиги агента и чем это грозит: [MCP и переменные окружения](/guide/manifest-dependencies#mcp-и-переменные-окружения).

## Какие правки делать вручную

| Задача                            | Как                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Новый проект                      | `bapm init -y --target cursor`                                                                            |
| Добавить пакет из GitHub          | `bapm install acme/agent-skills` (допишет в манифест)                                                     |
| Подкаталог репозитория, путь, MCP | Правка `bapm.yml`, затем `bapm install`                                                                   |
| Удалить пакет                     | `bapm uninstall <имя>` (точное имя, alias, URL или basename пути) — см. [uninstall](/reference/uninstall) |

## Частые ошибки

| Сообщение                                                | Что делать                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| `No manifest found`                                      | В текущем каталоге нет `bapm.yml` / `apm.yml`                         |
| `Manifest requires "name"` / `"version"`                 | Добавьте оба поля                                                     |
| `Manifest "active" rejects legacy bare host-token lists` | `active: { target: cursor }` вместо `active: [cursor]`                |
| `must have exactly one source kind`                      | В записи зависимости указан больше чем один источник (`git`, `path`…) |
| `OpenAPM v0.1 rejects top-level "workspaces"`            | Уберите поле `workspaces`: bapm его не поддерживает                   |

Дальше: [Зависимости](/guide/manifest-dependencies) · [Личные настройки](/guide/manifest-overlay) · [Lock-файл](/guide/lockfile).
