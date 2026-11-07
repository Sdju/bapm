# Registry: клиент за флагом, сервер не заявлен

**Статус:** намеренно (неполная роль)  
**Класс:** намеренное отличие

## Суть

OpenAPM описывает класс Registry (хост пакетов). APM ходит в registry как клиент. bapm заявляет только consumer/producer/governance; установка из registry спрятана за `BAPM_EXPERIMENTAL_REGISTRIES=1`.

## Состояние

| Источник     | Позиция                                                 |
| ------------ | ------------------------------------------------------- |
| APM          | Клиент registry в обычном install/publish.              |
| OpenAPM      | Класс Registry (req-rg-001) — отдельная роль.           |
| Спека bapm   | `CONFORMANCE.md`: Registry = n/a.                       |
| Код bapm     | Клиент есть, без env-флага путь не активируется.        |
| Документация | `guide/conformance.md`, `guide/manifest-registries.md`. |

## Вариации

1. Полный registry-сервер — вне scope.
2. Клиент всегда включён, как в APM.
3. Клиент только с флагом (текущий выбор).

## Поведение сейчас

Без `BAPM_EXPERIMENTAL_REGISTRIES=1` зависимость `id` + `registry` не ставится как обычный git-пакет. Роль «bapm как registry» не реализуется и не заявляется.
