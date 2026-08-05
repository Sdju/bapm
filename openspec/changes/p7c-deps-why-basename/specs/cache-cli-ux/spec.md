## ADDED Requirements

### Requirement: Cache clean dry-run preview
Core modules wipe (`cacheClean` / equivalent) MUST accept a dry-run mode that reports would-remove entry count and/or names under the modules-cache root without deleting. When dry-run is set, confirmation/`-y` MUST NOT be required. An absent root MUST succeed as already clean (would-remove 0). `bapm cache clean --dry-run` MAY expose the same core path for symmetry with `deps clean --dry-run`; if the CLI flag is not wired, core MUST still support dry-run for deps consumers.

#### Scenario: dry-run leaves cache intact
- **WHEN** `cacheClean` (or `bapm cache clean --dry-run` if wired) runs with dry-run against a populated modules cache
- **THEN** cache entries MUST remain and the result MUST indicate a successful preview with a positive would-remove count or listed names when entries exist

#### Scenario: dry-run absent root
- **WHEN** dry-run clean runs and the modules-cache root is absent
- **THEN** the result MUST succeed without deletion and report would-remove 0 / already clean

## MODIFIED Requirements

### Requirement: Cache clean removes content with confirm
`bapm cache clean` MUST remove modules-cache content for the documented root. Without `-y` / yes flag, the command MUST require confirmation (or refuse to delete) unless dry-run preview is requested. With `-y`, it MUST proceed non-interactively. After clean, subsequent lock/install MUST still be correct after re-resolve (no corrupt lock identity). Dry-run MUST NOT delete.

#### Scenario: Clean with yes removes entries
- **WHEN** `bapm cache clean -y` runs against a populated modules cache
- **THEN** cache entries under that root MUST be removed

#### Scenario: Clean without yes does not silent-delete
- **WHEN** `bapm cache clean` runs without `-y` in a non-interactive context without confirmation
- **THEN** the command MUST NOT silently delete the entire cache

#### Scenario: Dry-run does not require yes
- **WHEN** modules wipe is invoked in dry-run mode without `-y`
- **THEN** the operation MUST NOT refuse solely for lack of yes and MUST NOT delete
