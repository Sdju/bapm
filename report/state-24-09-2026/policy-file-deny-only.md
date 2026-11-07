# Файл политики только запрещает

**Статус:** намеренно  
**Класс:** продукт

## Суть

`apm-policy.yml` / `bapm-policy.yml` (и org policy) умеют `executables.deny` и `deny_all`. Секция `mcp:` игнорируется. `executables.allow` в файле политики — ошибка. Командный allow живёт в `bapm.yml`.

## Состояние

| Источник     | Позиция                                                                                |
| ------------ | -------------------------------------------------------------------------------------- |
| APM          | Policy file ближе к общему документу allow/deny/mcp.                                   |
| OpenAPM      | Governance policy: deny-wins; allow может жить в проекте отдельно.                     |
| Спека bapm   | Policy discovery: deny/deny_all; project grant — `executables` манифеста + user store. |
| Код bapm     | Policy evaluate отвергает allow в policy-файле; `mcp:` не читается.                    |
| Документация | `guide/situations/policy-mcp.md`, `reference/policy.md`.                               |

## Вариации

1. Как APM: allow и mcp-правила в policy-файле.
2. Policy = только deny, allow в манифесте (текущее).
3. Игнорировать неизвестные ключи молча — нет, `allow` в policy падает.

## Поведение сейчас

Команда пишет:

```yaml
# bapm.yml
executables:
  allow:
    acme/mcp-tools: { mcp: true }
```

Org/repo policy может только запретить. Прямые `dependencies.mcp` корня политика не режет.
