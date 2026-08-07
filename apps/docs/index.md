# bapm

**Better Agent Package Manager** — аналог [microsoft/apm](https://github.com/microsoft/apm) на TypeScript с явной архитектурой.

Менеджер зависимостей для конфигурации AI-агентов: манифест, lockfile, транзитивное разрешение. Материализация в хост выполняется через **integration packages**; runtime-матрица сегодня **cursor-only** (`bapm-integration-cursor`). Claude и Codex предоставляют marketplace-output integrations, но не runtime-адаптеры. Multi-client runtime adapters (Copilot, Claude, …) — **out of scope / later**, не shipped in-tree.

См. [Conformance & OpenAPM boundary](/guide/conformance) и корневой [`CONFORMANCE.md`](../../CONFORMANCE.md).
