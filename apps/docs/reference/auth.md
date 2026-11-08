# bapm auth — учётные данные для git-хоста

Read-only команда: показывает, какой токен bapm возьмёт для хоста, откуда он берётся, и — по флагу `--check` — проверяет его через REST API. Ничего не пишет в `~/.bapm/config.json`, не меняет git credential helper и не запрашивает токен интерактивно.

## Использование

```text
bapm auth <host> [--check] [--export] [-v]
```

`HOST` — имя хоста (`github.com`, `gitlab.com`, `ghe.corp.example`), а не URL репозитория или маркетплейса. Поддерживаемые псевдонимы:

| Аргумент               | Класс        | Куда резолвится                                     |
| ---------------------- | ------------ | --------------------------------------------------- |
| `github`, `github.com` | `github`     | `github.com`                                        |
| `ghes`                 | `ghes`       | значение `GITHUB_HOST` (обязательно)                |
| `gitlab`, `gitlab.com` | `gitlab`     | `gitlab.com`                                        |
| `azure`, `ado`         | `ado`        | `dev.azure.com`                                     |
| `<fqdn>`               | по окружению | класс из `GITHUB_HOST` / `GITLAB_HOST` / `ADO_HOST` |

Self-managed хосты классифицируются по переменным окружения, а не по имени. Без подсказки такой хост получает класс `generic`, и команда завершается с кодом `1`, предлагая нужную переменную. Для Azure DevOps Server используйте `ADO_HOST` (или `APM_ADO_HOSTS`).

## Порядок резолва

`bapm auth` использует общий модуль Auth, поэтому порядок совпадает с остальными командами:

| Хост                 | Переменные (первая найденная побеждает)      |
| -------------------- | -------------------------------------------- |
| GitHub / GHES / GHEC | `GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_APM_PAT` |
| GitLab               | `GITLAB_APM_PAT`, `GITLAB_TOKEN`             |
| Azure DevOps         | `ADO_APM_PAT`                                |

Токены не пересекаются между классами: токен GitHub не будет предложен для GitLab или ADO. Git credential helper и `gh auth token` этот релиз не читает — `bapm doctor` подскажет, если нужного источника нет.

По умолчанию команда сообщает только источник (`GITHUB_TOKEN`, `GITLAB_APM_PAT`, …), класс хоста при `-v` и никогда не печатает сам токен.

## `--export`

Печатает на stdout ровно одну строку для `eval`:

```bash
eval "$(bapm auth github.com --export)"
```

Каноническая переменная выбирается по классу хоста:

| Класс         | Переменная       |
| ------------- | ---------------- |
| GitHub / GHES | `GITHUB_APM_PAT` |
| GitLab        | `GITLAB_APM_PAT` |
| ADO           | `ADO_APM_PAT`    |

Значение экранируется для POSIX shell. При `--export` весь остальной вывод уходит в stderr, поэтому случайная диагностика не попадёт в `eval`. Если токена нет или `--check` его отклонил, stdout остаётся пустым, а код выхода — `1`.

:::caution
`--export` печатает токен в терминал: он может остаться в scrollback и истории shell. Если нужно только узнать, есть ли credential, запускайте без `--export`.
:::

## `--check`

Без `--check` команда ничего не проверяет по сети. С флагом она делает один GET к identity endpoint хоста:

| Класс      | Endpoint                                                       | Заголовок               |
| ---------- | -------------------------------------------------------------- | ----------------------- |
| GitHub.com | `https://api.github.com/user`                                  | `Authorization: Bearer` |
| GHES       | `https://<host>/api/v3/user` (или `GITHUB_API_URL`)            | `Authorization: Bearer` |
| GHEC       | `https://api.<host>/user`                                      | `Authorization: Bearer` |
| GitLab     | `https://<host>/api/v4/user`                                   | `PRIVATE-TOKEN`         |
| ADO        | `https://app.vssps.visualstudio.com/_apis/profile/profiles/me` | `Authorization: Basic`  |

Редиректы не преследуются: токен не должен уехать на другой endpoint.

`--check` различает три исхода, потому что «API отказал» и «API не ответил» требуют разных действий:

| Исход                                        | Вывод                              | Код |
| -------------------------------------------- | ---------------------------------- | --- |
| API принял токен                             | validated                          | `0` |
| API отклонил (`401`, `403` для обычного PAT) | rejected — нужен новый токен       | `1` |
| API недоступен, `5xx`, rate limit, редирект  | could not validate; токен остаётся | `0` |
| GitHub App installation token (`ghs_`)       | could not validate; токен остаётся | `0` |

Последние две строки важны для CI: временный `502` или captive portal не должен ломать сборку. `GITHUB_TOKEN` в GitHub Actions — installation token без пользовательского контекста: `/user` отвечает `403`, хотя читать репозитории он может.

## Коды выхода

| Код | Значение                                                                 |
| --- | ------------------------------------------------------------------------ |
| `0` | Токен есть; с `--check` он либо подтверждён, либо не опровергнут         |
| `1` | Токена нет, хост не поддержан/некорректен, либо `--check` отклонил токен |

## Примеры

```bash
bapm auth github.com                 # откуда берётся токен
bapm auth github.com --check         # проверить через API
bapm auth gitlab.com --check -v      # плюс классы хоста и credential
eval "$(bapm auth gitlab.com --export)"   # выставить в текущем shell
```

## См. также

- [doctor](/reference/doctor) — окружение, git и сеть.
- [marketplace](/reference/marketplace) — регистрация маркетплейсов.
- [Переменные окружения и registries](/guide/manifest-registries).
