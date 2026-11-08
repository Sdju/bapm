# Зависимости

Пакеты агента перечисляются в `dependencies.apm`, MCP-серверы — в `dependencies.mcp`. Обзор остальных полей манифеста: [bapm.yml](/guide/config-manifest).

## Пакеты: `dependencies.apm`

### Репозиторий GitHub

```yaml
dependencies:
  apm:
    - acme/agent-skills # ветка по умолчанию
    - acme/agent-skills#v1.2.0 # тег, ветка или коммит
    - github.com/acme/agent-skills # то же, с явным хостом
```

Так же пакет добавляется командой: `bapm install acme/agent-skills`.

### Подкаталог репозитория

Строка `acme/monorepo/skills/review` **не** означает подкаталог: bapm воспримет её как адрес репозитория `https://github.com/acme/monorepo/skills/review` и не найдёт его. Для подкаталога используйте объект:

```yaml
dependencies:
  apm:
    - git: https://github.com/acme/monorepo
      path: skills/review
      ref: main
```

### Любой git-репозиторий

```yaml
dependencies:
  apm:
    - git: https://gitlab.example.com/team/agent-rules.git
      ref: v2.0.0
```

### Локальный каталог

```yaml
dependencies:
  apm:
    - path: ./tools/team-skills
```

В каталоге должен быть свой `bapm.yml` или `apm.yml` с `name` и `version`. Запись попадает в общий lock, поэтому путь должен существовать у всех, кто работает с репозиторием. В lock путь хранится относительно корня проекта (в POSIX-форме, например `tools/team-skills`), поэтому `bapm.lock.yaml` переносим между машинами и CI.

Для личных черновиков, которые есть только у вас, используйте `local` — см. [Личные пакеты](/guide/situations/personal-local-lock).

### Только часть пакета

Если из большого пакета нужно несколько skills или пакет нужен только одному из агентов, сузьте установку:

```yaml
dependencies:
  apm:
    - git: https://github.com/acme/toolkit.git
      skills: [code-review, commit-message] # только эти skills
      targets: [cursor] # только для Cursor
```

Пакет всё равно скачивается целиком, фильтр применяется при раскладке. Остальные типы файлов (rules, agents) `skills:` не отфильтровывает. Пустой список `skills: []` — ошибка.

### Registry и маркетплейс {#registry}

```yaml
dependencies:
  apm:
    - id: my-pkg # из приватного registry (экспериментально)
      registry: my-registry
      version: "^1.0.0"
    - name: plugin-name # из зарегистрированного маркетплейса
      marketplace: my-marketplace
```

Настройка registry: [Registries](/guide/manifest-registries). Поиск в маркетплейсе: [search](/reference/search).

### Правило одного источника

В каждой записи ровно один источник: `git`, `path`, `id`, `registry`, `marketplace` или `local`. `path` рядом с `git` означает подкаталог, `registry` рядом с `id` — имя registry; это не второй источник. Иначе будет ошибка `must have exactly one source kind`.

## MCP-серверы: `dependencies.mcp`

```yaml
dependencies:
  mcp:
    - name: github
      registry: false
      transport: stdio
      command: npx
      args: ["-y", "@modelcontextprotocol/server-github"]
      env:
        GITHUB_TOKEN: "${GITHUB_TOKEN}"
    - name: docs
      registry: false
      transport: http
      url: https://mcp.example.com/
```

`registry: false` означает, что сервер описан целиком здесь, а не берётся из MCP-registry.

::: warning Registry-only MCP пока не поддерживается
Запись без `command` и `url`, которая просит lookup в MCP-registry (`registry: true` или имя/URL registry), завершает `install` ошибкой `MCP_REGISTRY_UNSUPPORTED` до записи конфигов агента. Опишите сервер явно: `registry: false`, `transport`, `command`/`url`.
:::

По умолчанию ставятся только MCP-серверы, объявленные прямо в вашем `bapm.yml`; серверы, которые приносят зависимости, молча пропускаются. Так пакет не может без вашего ведома добавить агенту исполняемый процесс. Включить их можно разово флагом `bapm install --trust-transitive-mcp` или постоянно, разрешив конкретный пакет в `executables` или через `bapm approve`. При наличии grant-поверхности пакеты с MCP, которых нет в allow/deny, пропускаются с предупреждением `MCP_NOT_APPROVED`, а фатально install завершается только при явном deny или для упомянутого-но-неразрешённого пакета. Подробнее: [MCP-сервер не появился](/guide/situations/policy-mcp).

## MCP и переменные окружения

В `env` и `headers` MCP-сервера можно ссылаться на переменные: `${VAR}`, `${env:VAR}` или `<VAR>` (как в APM), либо `{bake:VAR}` (только bapm). Откуда берутся значения: [env в манифесте](/guide/config-manifest#переменные-для-mcp-env).

Что происходит дальше, зависит от агента:

- **Cursor, OpenCode, VS Code/Copilot и подобные хосты** умеют подставлять переменные при запуске MCP-сервера. bapm переписывает `${VAR}` и `<VAR>` в родную форму хоста (`${env:VAR}` для Cursor, `{env:VAR}` для OpenCode) и **не записывает секрет в конфиг**. Значение должно быть в окружении на машине, где запускается агент.
- **Kiro и Copilot CLI** оставляют `${VAR}` в конфиге, и агент подставляет значение сам при запуске.
- **Codex** не умеет подставлять переменные в `env`, поэтому `env` подставляется при `install`. Для `headers` Codex использует отдельные поля: `Authorization: "Bearer ${VAR}"` → `bearer_token_env_var`, значение ровно `${VAR}` → `env_http_headers`; секрет в `config.toml` не попадает.
- **`{bake:VAR}`** — явная директива bapm: подставить значение при `install` и записать его в конфиг хоста (даже для Cursor/OpenCode). Если переменной нет, install завершается ошибкой.

В `bapm.lock.yaml` сервер всегда записывается как в манифесте, с `${VAR}` / `{bake:VAR}`, без подставленных значений.

::: warning Секреты в конфиге агента
Конфиги, где значение подставлено (`{bake:VAR}` или Codex `env`), содержат настоящие секреты — держите такие файлы в `.gitignore`. Для Cursor/OpenCode предпочитайте `${VAR}`: bapm запишет ссылку, а значение возьмётся из окружения при запуске.

Версии bapm до этого исправления записывали подставленные значения и в lock. Если такой lock уже закоммичен, выполните `bapm install`, чтобы переписать его, и смените попавшие в историю git токены.
:::

`headers` у HTTP/SSE-серверов обрабатываются так же, как `env`. Cursor и OpenCode сохраняют ссылку на переменную; Codex переводит её в `http_headers` / `env_http_headers` / `bearer_token_env_var`; в lock сохраняются исходные `${VAR}`. Если заголовок не появился в конфиге, проверьте, что выбранный хост умеет писать `headers`.

## LSP и canvas

`dependencies.lsp` bapm читает и сохраняет, но LSP-серверы пока **не деплоит**. Непустой `dependencies.lsp` (или `devDependencies.lsp`) в корневом или зависимом манифесте даёт предупреждение `LSP_UNSUPPORTED` с именем пакета и серверов; установка остальных файлов продолжается.

Ключ `canvas:` в манифесте или primitive с типом `canvas` даёт `CANVAS_UNSUPPORTED`: canvas не реализован, ничего не разворачивается и в trust-гейты не попадает. Это не ошибка конфигурации — просто явное предупреждение вместо молчаливого игнорирования.

Подробнее: [install](/reference/install#dependencies-lsp-не-деплоится), [Совместимость](/guide/conformance).

## Частые ошибки

| Сообщение                                         | Что делать                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| `git ls-remote https://github.com/a/b/c … failed` | Строка с тремя сегментами — это не подкаталог. Используйте `git` + `path` |
| `Failed to load local package manifest`           | В каталоге `path:` нет `bapm.yml` / `apm.yml` с `name` и `version`        |
| `must have exactly one source kind`               | Оставьте в записи один источник                                           |
| `MCP env bake failed: unresolved placeholder`     | Задайте переменную в окружении или в `env` манифеста                      |
