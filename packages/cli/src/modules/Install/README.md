# Install

Thin CLI wrapper over `@bapm/core` `runInstall`. Registers `bapm-target-cursor` for e2e
host materialize. Parses `--frozen` / rejects frozen+`--update`.

Domain logic lives in `@bapm/core` — this module stays a FEOD command-facing service.
