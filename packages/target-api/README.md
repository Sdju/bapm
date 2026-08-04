# bapm-target-api

Shared **contracts and registry** for bapm host targets.

## Boundary

| Package                                | May depend on                                          |
| -------------------------------------- | ------------------------------------------------------ |
| `@bapm/core`                           | `bapm-target-api` only (no concrete `bapm-target-*`)   |
| `bapm-target-cursor` (and other hosts) | `bapm-target-api`                                      |
| CLI / tests                            | Register concrete targets into a registry created here |

Core Install discovers primitives and calls `materialize` on registered targets through this package. Host packages implement detection, deploy roots, and disk writes — core never imports them.
