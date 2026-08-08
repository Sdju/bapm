## ADDED Requirements

### Requirement: Concrete targets own host layout and compile emission

Each concrete `bapm-target-<id>` package MUST own its host-specific detection signals, deploy layout, primitive materialization mapping, MCP configuration layout, and compile output rendering/default path. `@bapm/core` and the CLI composition root MUST use only generic target-api contracts for these operations and MUST NOT contain Cursor-specific compile rendering, `AGENTS.md` defaulting, deploy-path attribution, or target-id allowlists.

#### Scenario: Cursor layout remains in cursor target package

- **WHEN** inspecting the implementation of Cursor detection, deploy mapping, MCP path reporting, and compile output after this change
- **THEN** Cursor-specific layout and rendering logic MUST reside in `bapm-target-cursor`, not in `@bapm/core` or the CLI command implementation

### Requirement: Composition root registers available target packages

The application composition root MUST register target packages available to its distribution into a shared target registry before passing that registry to core compile or install orchestration. Core MUST remain independent of concrete target package imports, and tests MUST be able to provide a registry containing arbitrary target doubles.

#### Scenario: CLI registers packaged targets outside core

- **WHEN** CLI runs compile or install in a distribution containing `bapm-target-cursor`
- **THEN** the composition root MUST register Cursor before invoking core, while `@bapm/core` MUST not import that package
