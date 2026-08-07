# Architecture

```
packages/core         @bapm/core          domain: manifest, lockfile, resolver, install
packages/cli          bapm                thin CLI over @bapm/core
packages/integration-api    bapm-integration-api     generic capability contracts between core and integrations
packages/integration-cursor bapm-integration-cursor  cursor-only runtime materialization
packages/integration-claude bapm-integration-claude  Claude marketplace output
packages/integration-codex  bapm-integration-codex   Codex marketplace output
apps/docs             @bapm/docs          VitePress
```

Host behavior is supplied by **integration packages**. Runtime materialization is **cursor-only** today and remains outside `@bapm/core`.

Claude and Codex are marketplace-output-only integrations, not runtime adapters. Multi-target runtime support is a later track.

OpenAPM claim vs APM product CLI boundary: [Conformance & OpenAPM boundary](/guide/conformance).

Референс-реализация (Python): `.samples/apm` → [microsoft/apm](https://github.com/microsoft/apm) (локально, вне git).
