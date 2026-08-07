## 1. Target MCP contract

- [x] 1.1 Require successful target MCP configure reports to expose a non-empty project-relative configuration path, and return that path from the Cursor target.
- [x] 1.2 Update target API and Cursor-target unit coverage for the reported configuration path.

## 2. Core lock inventory

- [x] 2.1 Replace core's fixed Cursor MCP inventory key and path fallback with the configuring target id and its reported path.
- [x] 2.2 Preserve loaded legacy MCP inventory entries while merging the current target's configuration entry.

## 3. Behavioural verification

- [x] 3.1 Add a non-Cursor mock-target install test that verifies target-keyed lock inventory and a distinct reported configuration path.
- [x] 3.2 Add regression coverage that Cursor MCP install still records `.cursor/mcp.json` from the target report.
- [x] 3.3 Run focused package tests and static checks; validate the OpenSpec change.
