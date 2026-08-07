## Purpose

Defines the active Cursor integration runtime contract under the canonical integration vocabulary while retaining its existing observable host behavior.

## ADDED Requirements

### Requirement: Cursor integration retains runtime behavior after specification rename
The active Cursor integration specification MUST describe `@bapm/integration-cursor` using integration-neutral terminology and retain its documented detection, primitive deployment, MCP configuration, compile-emission, path-safety, and inventory-report behavior.

#### Scenario: Cursor capability remains observable through integration API
- **WHEN** install or compile selects the registered Cursor integration after the active specification rename
- **THEN** the observable files, registered-root safety, and reports remain equivalent to the pre-cleanup behavior
