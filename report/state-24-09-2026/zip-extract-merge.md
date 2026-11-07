# Zip больше не заменяет каталог целиком

**Статус:** исправлено (working tree, change `fix-install-safety`)  
**Класс:** баг → намеренное отличие от «replace»

## Суть

Раньше `bapm install ./pack.zip` удалял текущий каталог (включая `.git`) и подставлял архив. Спека и APM ближе к «положить артефакт в проект», не «rm -rf .».

## Состояние

| Источник     | Позиция                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | Install из archive не принят как уничтожение git-дерева; типично распаковка в cwd.                                                            |
| OpenAPM      | Pack zip — контейнер файлов пакета; consumer extract не обязан replace root.                                                                  |
| Спека bapm   | Delta `install-pipeline`: merge; конфликт содержимого — fail closed до записи. Registry materialize по-прежнему `replace`.                    |
| Код bapm     | `Pack/safeExtract.ts` `mode: "merge"` из `extract.ts`. Конфликт: symlink, файл вместо dir, разный контент. Флаг `wx`, откат созданных файлов. |
| Документация | `reference/install.md`, `pack.md`: merge + `Refusing to overwrite existing files`.                                                            |

## Вариации

1. Replace каталога (старое, опасно).
2. Merge + fail on conflict (текущее).
3. Merge + `--force` перезаписывает — `--force` всё ещё no-op, см. [install-force-noop.md](./install-force-noop.md).

## Поведение сейчас

`.git` и посторонние файлы остаются. Повторная установка того же zip в каталог с тем же `bapm.yml` проходит, если байты совпали; другой `bapm.yml` — отказ. Staging не выносится в parent directory.
