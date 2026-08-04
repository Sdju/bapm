# Architecture

```
packages/core   @bapm/core   domain: manifest, lockfile, resolver, install, adapters
packages/cli    bapm         thin CLI over @bapm/core
apps/docs       @bapm/docs   VitePress
```

Референс-реализация (Python): `.samples/apm` → [microsoft/apm](https://github.com/microsoft/apm) (локально, вне git).
