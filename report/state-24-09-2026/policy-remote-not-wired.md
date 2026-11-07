# Remote policy discovery не подключено как в спеке

**Статус:** открыто  
**Класс:** долг спеки / неполная реализация

## Суть

Спеки governance упоминают цепочки remote/extends (ADO, multi-candidate). Заявлено и реализовано: `local`, затем `github-owner-dotgithub`. Остальное — scope out.

## Состояние

| Источник     | Позиция                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| APM          | Более длинные cascade (в т.ч. Azure DevOps) в полном продукте.                                                |
| OpenAPM      | Расширяемые providers; не все обязательны для claim.                                                          |
| Спека bapm   | Часть текстов ещё про remote discovery «в этом change». `CONFORMANCE.md`: ADO / multi-candidate out of scope. |
| Код bapm     | Providers: local file, github owner `.github`.                                                                |
| Документация | `reference/policy.md`, conformance limitations.                                                               |

## Вариации

1. Дописать провайдеры — отдельный change.
2. Вычистить спеки от «wired remote».
3. Считать текущие два провайдера полным Governance — так и заявлено, минус ADO.

## Поведение сейчас

`bapm policy status` видит репо-файл и, если есть, org policy с github.com owner. Чужие хосты и ADO cascade не ищутся.
