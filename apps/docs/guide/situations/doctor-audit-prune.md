# Что-то сломалось

## Ситуация

Кто-то правил файлы в `.agents/skills/` или `.cursor/` вручную, удалял каталоги в `apm_modules/`, переключал ветки, и теперь install или агент ведут себя странно.

## Шаги

### 1. Проверьте окружение

```bash
bapm doctor
```

```text
PASS	git	git is available on PATH
PASS	manifest	manifest readable
PASS	lockfile	lockfile readable
PASS	modules	apm_modules ok
PASS	auth	GITHUB_TOKEN/GH_TOKEN not set
```

`doctor -v` дополнительно проверяет сетевой доступ к github.com (свой git-сервер проверьте сами: `git ls-remote <url>`). Если `bapm.local.yml` или `bapm.local.lock.yaml` случайно закоммичены, в выводе появится строка `PASS local-overlay … is git-tracked` (или `local-lock`): она не помечена как ошибка, так что смотрите на текст.

### 2. Найдите расхождения с lock

```bash
bapm audit --ci
```

```text
Hash mismatch for .agents/skills/code-review/SKILL.md: expected dab0…, observed bff5…
```

`audit` покажет изменённые и удалённые файлы.

### 3. Восстановите

```bash
bapm install
```

Обычный install перезаписывает изменённые и возвращает удалённые файлы в состояние из lock. Ручные правки в этих файлах пропадут; если они нужны, сохраните их заранее и перенесите в пакет.

`bapm install --frozen` для восстановления не подходит: он только сообщает о расхождении и завершается с ошибкой.

### 4. Уберите лишнее

```bash
bapm prune --dry-run   # что будет удалено
bapm prune
```

`prune` удаляет из `apm_modules/` пакеты, которых больше нет в lock. Файлы в каталогах агента (`.agents/skills/`, `.cursor/`) он не трогает: skills от удалённых пакетов нужно убрать вручную.

Если `apm_modules/` повреждён целиком, очистите его и установите заново:

```bash
bapm cache clean -y
bapm install
```

## Результат

`bapm audit --ci` завершается сообщением `Audit CI clean`.

## Если не помогло

| Проблема                                            | Что делать                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `doctor` проходит, `audit` падает                   | Проблема в файлах, а не в окружении: выполните `bapm install`                            |
| В `.agents/skills/` остался skill удалённого пакета | Удалите каталог вручную                                                                  |
| `bapm doctor`: `… is git-tracked`                   | `git rm --cached bapm.local.yml bapm.local.lock.yaml`                                    |
| Lock явно не соответствует манифесту                | Не правьте его руками: `bapm install` или [`bapm update`](/guide/situations/update-deps) |
