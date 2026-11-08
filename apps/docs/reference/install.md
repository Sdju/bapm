# bapm install — флаги

По `bapm install --help`.

## Использование

```text
bapm install [options]
bapm install <package-ref...>   # добавить в dependencies.apm (или --dev → devDependencies.apm), затем install
bapm install <archive.zip>      # install из pack-produced plain zip
```

Неизвестные флаги отвергаются. Локальный путь к `.zip` обрабатывается как archive; остальные positionals — package refs. Нельзя смешивать `.zip` и package refs. Frozen-режим отклоняет positional package-ref add.

Если манифеста ещё нет, positional package-ref add может создать минимальный манифест (см. notes в help).

## Параметры

| Флаг                     | Значение       | Эффект                                                                                                                                                                   | Default                         |
| ------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `--frozen`               | —              | Fail, если lock нет, пины/ref дрейфуют или lock не записывает would-be deployed файлы; при наличии — re-verify `deployed_file_hashes` и `content_hash` локальных пакетов | off (но см. CI ниже)            |
| `--no-frozen`            | —              | Отключить frozen, в том числе CI-default                                                                                                                                 | —                               |
| `--dry-run`              | —              | Превью direct deps / would-add; без durable project writes                                                                                                               | off                             |
| `--force`                | —              | Принимается только для совместимости с APM; без эффекта. Не обновляет refs и не обходит frozen/policy                                                                    | off                             |
| `--allow-insecure`       | —              | Dual consent для direct `http://` deps с `allow_insecure: true`                                                                                                          | off                             |
| `--allow-insecure-host`  | `<hostname>`   | Разрешить transitive `http://` с этого FQDN (повторяемый)                                                                                                                | —                               |
| `--dev`                  | —              | При package-ref add писать в `devDependencies.apm` (без positional — no-op)                                                                                              | off                             |
| `--only`                 | `apm` \| `mcp` | Только APM packages (без MCP) или только MCP configure (без APM materialize)                                                                                             | оба                             |
| `--global`, `-g`         | —              | User-scope install из `~/.bapm` (`BAPM_HOME` override). В этом релизе — **только MCP**: требует `--only mcp`. Global skills/rules/compile — следующий slice              | off                             |
| `--mcp`                  | —              | Alias для `--only mcp` (в том числе для `bapm install -g --mcp`)                                                                                                         | —                               |
| `--target`               | `<id>`         | Принудительно активировать registered host target (игнорирует `active`, config target и detect)                                                                          | `active` → config → auto-detect |
| `--exclude`              | `<id>[,<id>]`  | Пропустить MCP configure для runtime id; список через запятую или несколько флагов; **не** полный skip install (повторяемый)                                             | —                               |
| `--update`               | —              | Переразрешить mutable refs; нельзя с frozen / CI-default frozen                                                                                                          | off                             |
| `--parallel-downloads`   | `<n>`          | Параллельные загрузки; `0` = serial                                                                                                                                      | `4`                             |
| `-v`, `--verbose`        | —              | Богаче progress / diagnostics (не ослабляет frozen/policy)                                                                                                               | off                             |
| `--policy`               | `<path>`       | Явный policy-файл (побеждает `apm-policy.yml` / `bapm-policy.yml`)                                                                                                       | discovery                       |
| `--no-policy`            | —              | Пропустить только repo-local `apm-policy.yml`/`bapm-policy.yml`; org deny остаётся                                                                                       | off                             |
| `--no-policy-all`        | —              | Полный escape: пропустить local и org policy (также `BAPM_POLICY_DISABLE=1`)                                                                                             | off                             |
| `--trust-transitive-mcp` | —              | Деплоить MCP из зависимостей; по умолчанию только direct `dependencies.mcp`                                                                                              | off                             |
| `--trust-bin`            | —              | Согласие на deploy dependency/plugin `bin/` для этого запуска (если policy/ExecutableTrust позволяет)                                                                    | off (нужен явный consent)       |
| `--no-trust-bin`         | —              | Пропустить deploy `bin/` для этого запуска (даже если policy allow)                                                                                                      | —                               |
| `--help`, `-h`           | —              | Показать help                                                                                                                                                            | —                               |

## Замечания

- `--frozen` и `--no-frozen` взаимно исключаются.
- `--trust-bin` и `--no-trust-bin` взаимно исключаются; флаги не переопределяют org/project deny.
- Non-interactive (CI, `BAPM_NON_INTERACTIVE`, non-TTY или frozen) по умолчанию **не** деплоит dependency `bin/` без `--trust-bin` или persisted `executables.allow` с `bin: true`.
- TTY не считается согласием: интерактивный install тоже **не** деплоит dependency `bin/` без `--trust-bin` или persisted grant. Если deploy удержан, install печатает diagnostic с подсказкой передать `--trust-bin` или выполнить `bapm approve <пакет> --bin`.
- Frozen (явный или CI-default) нельзя сочетать с `--update`.
- Если env `CI` truthy (не `""`, `"0"`, `"false"`), install по умолчанию frozen, пока не передан `--no-frozen`.
- `--force` в текущей версии ничего не меняет: флаг принимается для совместимости с APM, но не влияет на установку, не обновляет refs и не обходит frozen/policy. Install печатает об этом warning в stderr. Он не связан с `--target`.
- `--no-policy` отключает только файл политики в репозитории (`apm-policy.yml` / `bapm-policy.yml`). Org policy и её `executables.deny`/`deny_all` продолжают действовать. Явный `--policy <path>` всё равно проверяется.
- `--no-policy-all` и `BAPM_POLICY_DISABLE=1` / `APM_POLICY_DISABLE=1` — полный escape: отключают и локальную, и org policy. Используйте только для диагностики.
- Frozen проверяет наличие lock, пины прямых зависимостей и хэши развёрнутых файлов, а также сверяет `#ref` прямых git-зависимостей с `resolved_ref` в lock. Расхождение ref при неизменном lock — ошибка `Frozen install ref drift`. См. [CI по lock-файлу](/guide/situations/ci-frozen).
- Frozen не разворачивает файлы, которых нет в lock. Для каждого пакета, поставляющего примитивы, lock должен содержать непустые `deployed_file_hashes` или `deployed_files`; иначе install падает с `INSTALL_FROZEN_UNDER_RECORDED` до записи harness-файлов/lock. Для локальных пакетов (`path:`/`local:`) дополнительно обязателен `content_hash` (или `tree_sha256`), и дерево пакета сверяется с ним: изменение содержимого или отсутствие хэша — тот же код ошибки с подсказкой выполнить `bapm install` и закоммитить lock. Для локального одиночного файла (`.agent.md`/`.instructions.md`/`.prompt.md`) сверяется хэш virtual-file snapshot: изменение исходного файла, symlink, неизвестный суффикс или невалидный/отсутствующий frontmatter не проходят frozen.
- Root-проект не является lock-зависимостью: root-примитивы и direct `dependencies.mcp` не требуют `deployed_file_hashes`. Проверяются только пакеты, которые реально поставляют примитивы.
- Выбор агента: `--target <id>` → `active` в `bapm.local.yml` → `active` в `bapm.yml` → `target` из `~/.bapm/config.json` → автоопределение → ошибка. В `active` можно перечислить несколько агентов, тогда файлы и MCP раскладываются для каждого поддерживающего хоста. У `grok-bot`, `hermes` и `intellij` нет автоопределения: выберите их через `--target <id>` или `active`. `intellij` — MCP-only: файловые примитивы и `compile` для него не поддерживаются. См. [Выбор агента](/guide/host-selection), [config](/reference/config).
- Файлы в каталогах агента с тем же путём, что у устанавливаемого пакета, перезаписываются без предупреждения.
- Если пакет убран из манифеста вручную, обычный (не-frozen) `install` удаляет файлы, которые предыдущий lock записал за этим пакетом в `deployed_file_hashes`. Если inventory нет (старый lock или путь не записан), файлы остаются. `install --frozen` (включая CI-default) cleanup не выполняет. Пустые каталоги после удаления не убираются. Надёжнее сначала выполнить `bapm uninstall <name>`: он чистит deployed-файлы по старому inventory до перезаписи lock.
- Grant-поверхность (`executables.allow` в `bapm.yml` или `bapm approve`/`deny`) не делает все dependency MCP обязательными: пакет, которого нет в allow/deny, пропускается с предупреждением `MCP_NOT_APPROVED`, а install продолжается. Фатально завершают install только явный deny (project/user/org, включая org `deny_all`) и пакет, упомянутый в grant-поверхности без `mcp: true`. `--trust-transitive-mcp` без grant-поверхности по-прежнему деплоит dependency MCP.
- MCP для Cursor пишется в `.cursor/mcp.json`; каталог создаётся при необходимости. Claude Code, Gemini, Kiro и Antigravity пишут MCP, только если каталог агента уже есть или создан в этом же install; иначе install печатает `bapm: warning: …` с путём каталога. См. [Поддерживаемые агенты](/guide/supported-hosts#layout).
- Copilot и Windsurf пишут MCP в user-global файлы `~/.copilot/mcp-config.json` и `~/.codeium/windsurf/mcp_config.json` (`COPILOT_HOME` / `CODEIUM_HOME`), общие для всех проектов на машине. Hermes пишет `$HERMES_HOME/config.yaml` (default `~/.hermes/config.yaml`), IntelliJ — `$XDG_CONFIG_HOME/github-copilot/intellij/mcp.json` (Windows `%LOCALAPPDATA%`). Install печатает для них `bapm: warning: MCP config for "<id>" was written to <path> …`: одноимённые серверы перезаписывает последний install. Чтобы не трогать общий файл, используйте `--exclude copilot,windsurf,hermes,intellij` (или `BAPM_NO_GLOBAL_MCP=1` для всех в CI); MCP при этом не конфигурируется, остальная установка продолжается. Для изоляции задайте отдельный `COPILOT_HOME`/`CODEIUM_HOME`/`HERMES_HOME`/`XDG_CONFIG_HOME` на проект или контейнер.

- `install <archive.zip>` добавляет файлы архива в текущий каталог и ничего не удаляет. Если файл из архива уже есть с другим содержимым (обычно `bapm.yml`), install завершается ошибкой `Refusing to overwrite existing files` до записи чего-либо. Поэтому ставьте архив в пустой каталог.
- Приватный registry с внутренним CA или TLS-inspecting proxy: задайте `NODE_EXTRA_CA_CERTS` до запуска Node или `BAPM_EXTRA_CA_BUNDLE` для additive CA bundle. См. [Private registry и TLS](/guide/situations/tls-private-registry).

## Global MCP (`--global` / `-g`)

`bapm install -g --only mcp` (или `bapm install -g --mcp`) читает user-scope проект
`~/.bapm` и настраивает MCP для пользовательских конфигов хоста:

| Host     | User-scope MCP config              |
| -------- | ---------------------------------- |
| Cursor   | `~/.cursor/mcp.json`               |
| OpenCode | `~/.config/opencode/opencode.json` |

- Global root: `~/.bapm`, либо `BAPM_HOME` (если задан). Там лежат `bapm.yml`
  и `bapm.lock.yaml`. Если их нет, `bapm install -g` создаёт минимальные
  `bapm.yml` и пустой `bapm.lock.yaml`; существующие файлы не перезаписываются.
- Project manifests, project lockfiles и project host-конфиги при `--global`
  **не читаются и не пишутся**. MCP-декларации берутся из `~/.bapm/bapm.yml`
  (`dependencies.mcp`).
- Выбор хоста: `--target cursor|opencode` либо автоопределение по
  `~/.cursor/` / `~/.config/opencode/`. Если оба хоста присутствуют, передайте
  `--target`, иначе install завершится ошибкой неоднозначности.
- `~/.bapm/config.json` остаётся user store для `bapm approve` / `bapm deny`;
  global install использует тот же trust/policy pipeline, что и project install.
- Этот slice поддерживает **только MCP**. `bapm install -g` без `--only mcp`
  завершается ошибкой с подсказкой перейти на `--only mcp`: global skills, rules,
  agents, commands, hooks и `compile` появятся в следующем slice.
- Неподдерживаемый для global scope хост (например `claude` или custom target)
  даёт ошибку `Global MCP is not supported for target(s): …`.

## Hooks в нативных конфигах

Hook-примитивы записываются в родную схему выбранного хоста. Плоский источник:

```json
{ "hooks": { "SessionStart": [{ "type": "command", "command": "./run.sh" }] } }
```

становится:

Cursor — `.cursor/hooks.json` (плоские handlers):

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [{ "type": "command", "command": "./.cursor/hooks/<hook>/run.sh" }]
  }
}
```

Claude Code — `.claude/settings.json` (matcher-группы):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "./.claude/hooks/<hook>/run.sh" }]
      }
    ]
  }
}
```

Codex CLI — `.codex/hooks.json` (matcher-группы без matcher по умолчанию):

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "./.codex/hooks/<hook>/run.sh" }] }
    ]
  }
}
```

Если источник уже содержит группы `{ "matcher": "Bash", "hooks": [...] }`, matcher и остальные поля handler/группы сохраняются. Claude дополнительно подставляет `"type": "command"` для плоской команды без `type`; Codex matcher по умолчанию не добавляет.

Принадлежность handlers хранится в sidecar `.cursor/bapm-hooks.json`, `.claude/bapm-hooks.json` или `.codex/bapm-hooks.json`. Повторный install удаляет только ранее установленные bapm handlers и сохраняет пользовательские записи в нативном файле; sidecar не пишется внутрь нативного JSON.

## `lifecycle:` не исполняется

Если корневой манифест или манифест зависимости содержит ключ `lifecycle:`, bapm его сохраняет, но **не запускает** ни одной команды. Install печатает предупреждение `LIFECYCLE_UNSUPPORTED` с именем пакета — по одному на корень и на каждую зависимость. Уберите блок или выполните шаги вручную; policy-обхода и shell-исполнения здесь нет.

```text
bapm: warning: LIFECYCLE_UNSUPPORTED: Package "lifecycle-leaf" declares a "lifecycle" block; bapm retains the key but does not execute lifecycle commands.
```

Сценарии: [Быстрый старт](/guide/quick-start), [Подключить bapm к проекту](/guide/situations/install-fresh), [CI по lock-файлу](/guide/situations/ci-frozen).

## `dependencies.lsp` деплоится в Claude Code и Copilot CLI

Корневой манифест и манифесты зависимостей могут объявлять LSP-серверы в `dependencies.lsp` (и `devDependencies.lsp`). bapm разворачивает их только в два хоста с нативной поддержкой:

| Хост        | Файл                                                          | Форма                                      |
| ----------- | ------------------------------------------------------------- | ------------------------------------------ |
| Claude Code | `.claude/skills/apm-lsp/.claude-plugin/plugin.json`           | `{ "name": "apm-lsp", "lspServers": … }`   |
| Copilot CLI | `.github/lsp.json`                                            | `{ "lspServers": … }`                      |

Claude использует `extensionToLanguage` и `startupTimeout`; Copilot — `fileExtensions` и `warmupTimeoutMs`. bapm переводит канонические `extensionToLanguage` / `startupTimeout` в родную форму хоста. Пользовательские (user-global) LSP-конфиги bapm не пишет.

Запись манифеста должна содержать `name`, stdio `command` и карту расширений:

```yaml
dependencies:
  lsp:
    - name: gopls
      command: gopls
      args: [serve]
      extensionToLanguage:
        ".go": go
```

`args`, `env`, `transport: stdio`, `initializationOptions`, `settings`, `workspaceFolder`, `startupTimeout`, `shutdownTimeout`, `restartOnCrash` и `maxRestarts` переносятся в конфиг хоста, где применимы. Bare-строка вместо объекта, `url`, не-stdio transport, дубликаты имён и невалидные `args` / `env` / language map завершают install ошибкой `INSTALL_LSP_INVALID` до записи конфига.

LSP зависимостей проходит через executable trust как тип `lsp`:

```yaml
executables:
  allow:
    owner/lsp-pkg:
      lsp: true
  deny:
    owner/untrusted-pkg:
      lsp: true
```

Явный `deny` и упомянутый, но не одобренный пакет дают `INSTALL_LSP_TRUST`; неупомянутый пакет пропускается с предупреждением `LSP_NOT_APPROVED`. Одобрить LSP зависимости можно через `bapm approve <пакет> --lsp` или `executables.allow.<пакет>.lsp: true`. Root-серверы (`dependencies.lsp` самого проекта) доверенные по определению, как и direct MCP.

Lock-инвентарь записывается в `lsp_servers`, `lsp_configs`, `lsp_target_servers` и `lsp_config_provenance` (`project:.` или `package:<name>`). Повторный install идемпотентен; удалённые из манифеста серверы удаляются из конфига хоста и lock. В `--frozen` конфиг поддерживается, но lock не переписывается.

Если активные хосты не поддерживают LSP (например, только Cursor), bapm ничего не пишет и печатает прежнее предупреждение `LSP_UNSUPPORTED` с именем пакета и серверов:

```text
bapm: warning: LSP_UNSUPPORTED: Package "lsp-leaf" declares LSP server(s) [yaml-language-server] under dependencies.lsp; bapm parses the entries but does not deploy LSP servers.
```

Для хостов, где LSP уже настроен, отдельного `LSP_UNSUPPORTED` предупреждения нет.

## Canvas не реализован

Если в манифесте есть ключ `canvas:` (не `null`/`false`) или при установке найден primitive с типом `canvas`, install печатает `CANVAS_UNSUPPORTED` с именем пакета/primitive и **не разворачивает** canvas. Canvas намеренно остаётся вне trust-гейтов, пока для него нет пути материализации. Проекты без LSP/canvas ничего из этого не видят.

```text
bapm: warning: CANVAS_UNSUPPORTED: Package "canvas-leaf" declares a "canvas" key; bapm does not implement canvas primitives and does not deploy them.
```
