# Architecture

```
packages/core         @bapm/core          domain: manifest, lockfile, resolver, install
packages/cli          bapm                thin CLI over @bapm/core
packages/integration-api   bapm-integration-api     types/utilities between core and targets
packages/integration-cursor bapm-integration-cursor cursor-only host materialization
apps/docs             @bapm/docs          VitePress
```

Host materialization uses **target packages** with a **cursor-only** matrix today — not in-tree multi-client adapters inside `@bapm/core`. Multi-target is a later track.

OpenAPM claim vs APM product CLI boundary: [Conformance & OpenAPM boundary](/guide/conformance).

Референс-реализация (Python): `.samples/apm` → [microsoft/apm](https://github.com/microsoft/apm) (локально, вне git).
