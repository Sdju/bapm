# Совместимость и граница OpenAPM

bapm разделяет три оси, которые легко спутать:

| Ось | Смысл | Позиция bapm |
| --- | --- | --- |
| **OpenAPM v0.1** | Нормативный wire: манифест, lock, policy, resolve, deploy | Заявленные классы в корневом [`CONFORMANCE.md`](../../../CONFORMANCE.md): Consumer, Producer, Governance; Registry N/A |
| **APM product CLI** | Полная командная и adapter-поверхность microsoft/apm | **Не** полный product CLI parity — bapm не drop-in клон APM CLI |
| **Host integrations** | Куда пакеты материализуются или эмитятся артефакты хоста | Runtime **только Cursor** через Cursor-integration; Claude/Codex — marketplace-output; multi-target runtime — позже |

## Опубликованное заявление

См. сгенерированные корневые артефакты:

- [`CONFORMANCE.md`](../../../CONFORMANCE.md) — классы, покрытие, **Limitations / non-conformance**
- [`CONFORMANCE.json`](../../../CONFORMANCE.json) — машиночитаемый twin

Не трактуйте «OpenAPM claimed» как «каждая фича APM CLI уже есть».

## Вне scope (по Limitations)

Кратко (подробности и полный dump — в [`CONFORMANCE.md`](../../../CONFORMANCE.md)):

- **multi-target** adapters кроме cursor (позже)
- **registry host** (rg-001 N/A; только client)
- Marketplace output и portable plugin packaging — через явные integrations и границу Agent Plugins; это не универсальная совместимость со всеми marketplace / client-extension
- Interactive **user-local approve/deny**, org **executables.deny/deny_all** и lockfile **require** vs withheld — заявлены; полный APM approve UX, hooks/bin/canvas gates остаются soft (MCP-only)
- OpenAPM **§10.3 host-class floor** заявлен; остаточная Auth-глубина и soft **tar.gz-only** container остаются limitations

Также намеренно (не баги): ∩-pick vs APM first-wins, dual-read branding, OpenAPM-strict YAML anchors.
