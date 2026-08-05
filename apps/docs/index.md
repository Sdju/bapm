# bapm

**Better Agent Package Manager** — аналог [microsoft/apm](https://github.com/microsoft/apm) на TypeScript с явной архитектурой.

Менеджер зависимостей для конфигурации AI-агентов: манифест, lockfile, транзитивное разрешение. Материализация в хост — через **target packages**; сегодня матрица **cursor-only** (`bapm-target-cursor`). Multi-client adapters (Copilot, Claude, …) — **out of scope / later**, не shipped in-tree.

См. [Conformance & OpenAPM boundary](/guide/conformance) и корневой [`CONFORMANCE.md`](../../CONFORMANCE.md).
