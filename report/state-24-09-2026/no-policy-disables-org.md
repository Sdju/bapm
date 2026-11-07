# `--no-policy` отключает и организационный deny

**Статус:** намеренно  
**Класс:** продукт / security UX

## Суть

Флаг звучит как «не искать `apm-policy.yml` в репо». Он выключает всё policy discovery, включая org `deny` / `deny_all`. То же делает `BAPM_POLICY_DISABLE=1`.

## Состояние

| Источник     | Позиция                                                                       |
| ------------ | ----------------------------------------------------------------------------- |
| APM          | `--no-policy` / disable — широкий выключатель.                                |
| OpenAPM      | Policy off — допустимый режим с оговоркой.                                    |
| Спека bapm   | `--no-policy` пропускает discovery/evaluation.                                |
| Код bapm     | Install `noPolicy` не вызывает providers, в том числе github-owner-dotgithub. |
| Документация | `reference/install.md`, `policy-mcp.md`.                                      |

## Вариации

1. Флаг глушит только файл в репозитории, org deny остаётся.
2. Флаг глушит всё (текущее).
3. Org deny нельзя отключить флагом — не сделано.

## Поведение сейчас

`bapm install --no-policy` поставит MCP, который org policy запретила. Это escape для отладки, не «чуть мягче репо-файл».
