# Совместимость и граница OpenAPM

Изолированная страница про APM / OpenAPM. Для повседневной работы с CLI она не нужна — начните с [быстрого старта](/guide/quick-start).

- Runtime host — opt-in пакет (пример: **Cursor** / `@bapm/integration-cursor`) через object-map `targets:` ([hosts](/guide/supported-hosts)).
- OpenAPM wire ≠ полная копия CLI [microsoft/apm](https://github.com/microsoft/apm).
- Полный dump классов и limitations: корневой [`CONFORMANCE.md`](../../../CONFORMANCE.md).

## Три оси

| Ось                   | Смысл                                         | Позиция bapm                                                                                                                                                 |
| --------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **OpenAPM v0.1**      | Wire: манифест, lock, policy, resolve, deploy | Claimed в [`CONFORMANCE.md`](../../../CONFORMANCE.md): Consumer, Producer, Governance; Registry N/A                                                          |
| **APM product CLI**   | Поверхность microsoft/apm                     | **Не** drop-in клон APM CLI                                                                                                                                  |
| **Host integrations** | Куда материализуются пакеты                   | Opt-in: Cursor / Claude / Codex (`@bapm/integration-*`) + `targets:`. Custom: npm / локальный модуль через object-map. Claude/Codex также marketplace-output |

## Вне scope (по Limitations)

Подробности — в [`CONFORMANCE.md`](../../../CONFORMANCE.md) / [`CONFORMANCE.json`](../../../CONFORMANCE.json):

- Встроенная **multi-target** runtime matrix (несколько клиентов «из коробки» в одном прогоне) — не claimed; кастомные integrations через object-map — поддерживаются отдельно ([hosts](/guide/supported-hosts))
- **registry host** (rg-001 N/A; только client)
- Marketplace / portable plugin packaging — не универсальная совместимость со всеми клиентами
- Interactive approve/deny, org deny gates — заявлены частично; полный APM approve UX и hooks/bin/canvas — soft (MCP-only)
- OpenAPM **§10.3** заявлен; Auth-глубина и soft tar.gz-only — limitations

Намеренно (не баги): ∩-pick vs APM first-wins, OpenAPM-strict YAML anchors, bapm-only source `local`, personal overlay `bapm.local.yml` (не часть OpenAPM wire и не `local:` source).
