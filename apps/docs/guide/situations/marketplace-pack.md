# Сборка маркетплейса

## Ситуация

Вы поддерживаете набор плагинов (skills, агенты, MCP) и хотите, чтобы пользователи Claude Code, Codex или GitHub Copilot могли подключить их как маркетплейс. Для этого нужен `marketplace.json` в формате каждого агента.

Это задача автора пакетов. Чтобы просто поставить чужие пакеты в свой проект, достаточно `bapm install`.

## Шаги

### 1. Опишите маркетплейс

```bash
bapm marketplace init
bapm marketplace package add …   # для каждого плагина
bapm marketplace check
```

Команды заполняют блок `marketplace:` в `bapm.yml`. Подробнее о полях: [marketplace](/guide/manifest-registries#marketplace), о флагах: [bapm marketplace](/reference/marketplace).

### 2. Проверьте без записи

```bash
bapm pack --dry-run
```

### 3. Соберите

```bash
bapm pack --marketplace all       # для Claude Code, Codex и Copilot (что включено)
bapm pack --marketplace claude    # только для Claude Code
bapm pack --marketplace copilot   # только для GitHub Copilot
bapm pack --marketplace-path claude=./dist/claude-marketplace.json
```

Нужны пакеты `@b-apm/integration-claude`, `@b-apm/integration-codex` и/или `@b-apm/integration-copilot`: они знают формат `marketplace.json` своего агента. Пути по умолчанию: `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, `.github/plugin/marketplace.json`.

### 4. Перед релизом

```bash
bapm pack --check-release   # версия в bapm.yml совпадает с git-тегом
bapm pack --check-versions  # версии пакетов маркетплейса согласованы
bapm pack --check-clean     # закоммиченный marketplace.json совпадает с генерируемым
```

`--check-clean` ничего не пишет: он заново собирает выбранные `marketplace.json` в памяти и сравнивает с файлами на диске. Drift или отсутствующий файл — exit `4`.

## Другие форматы

| Команда                     | Что получится                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `bapm pack --archive`       | zip-архив проекта, который можно поставить через `bapm install ./file.zip`             |
| `bapm pack --agent-plugins` | архив в переносимом формате [Agent Plugins](/guide/agent-plugins); нужен `plugin.json` |

Без флагов `bapm pack` тоже собирает zip-архив. Ставьте его в пустой каталог: `bapm install ./file.zip` не перезаписывает существующие файлы с другим содержимым и в этом случае завершается ошибкой.

Лишние файлы из архива исключаются через `.bapmignore` (синтаксис как у `.gitignore`). `bapm.local.yml` и `bapm.local.lock.yaml` не попадают в архив никогда.

## Если не получилось

| Проблема                                        | Что делать                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| Нет блока `marketplace:`                        | `bapm marketplace init`                                                                |
| pack отказывается из-за `.env`, `*.pem` и т. п. | bapm не упаковывает файлы, похожие на секреты. Удалите их или добавьте в `.bapmignore` |
| Нужна сеть, а её нет                            | С `--offline` pack завершится ошибкой, если пакеты нужно скачивать                     |
