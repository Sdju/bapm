# archive-safe-extract Specification

## Purpose

Defines a shared fail-closed zip archive extract policy for Pack install-from-archive and Registry materialize: path-escape and link rejection, entry/size caps, and cleanup of partial destinations so OpenAPM sc-002 depth is claimable without format migration.

## Requirements

### Requirement: Reject path-escape and absolute archive entries
Safe extract MUST refuse any archive member whose normalized path is absolute, contains a `..` segment, or would resolve outside the destination root. Refusal MUST be fail-closed on the first bad entry and MUST NOT write that entry.

#### Scenario: Dot-dot entry rejected
- **WHEN** an archive contains a member path with a `..` segment (for example `../../etc/passwd`)
- **THEN** extract MUST fail closed and MUST NOT write that member under the destination

#### Scenario: Absolute entry rejected
- **WHEN** an archive contains a member with an absolute path
- **THEN** extract MUST fail closed and MUST NOT write that member

### Requirement: Reject symlink and non-regular zip members
Safe extract MUST reject zip members that are symbolic links as indicated by zip unix mode / external attributes (APM-compatible `0xA000` symlink bit). Where the archive format exposes hardlinks or other non-regular types, extract MUST reject those members fail-closed. Regular files and directory markers MUST remain allowed.

#### Scenario: Symlink zip entry rejected
- **WHEN** a zip member is marked as a symlink via unix mode / external_attr
- **THEN** extract MUST fail closed before creating a link or following it into the destination tree

#### Scenario: Regular file still extracts
- **WHEN** a zip contains only regular file members within the destination root and under caps
- **THEN** extract MUST succeed and write those files under the destination

### Requirement: Fail-closed cleanup of partial destination
When extract fails mid-stream (unsafe entry, I/O error, or cap exceeded after any write), the system MUST clean up the partial extracted tree under the destination for that operation so a failed extract does not leave a dangling half-written package tree treated as success.

#### Scenario: Bad entry after partial write cleans dest
- **WHEN** extract writes one or more safe members then encounters a rejected entry or error
- **THEN** the operation MUST fail closed and MUST remove the partial contents under that destination for the failed extract

### Requirement: Default entry-count and uncompressed-size caps
Safe extract MUST enforce a default maximum of **10 000** archive entries (file members counted toward the cap) and a default maximum of **100 MB** total uncompressed payload bytes before or during extract. Exceeding either cap MUST fail closed. Caps MAY later become configurable; defaults MUST match these OpenAPM-aligned values. These caps close soft sc-004 size/entry depth on zip paths without claiming tar.gz-only container format.

#### Scenario: Entry count over 10000 fails
- **WHEN** an archive declares or yields more than 10 000 extractable file entries
- **THEN** extract MUST fail closed and MUST NOT complete a successful materialize

#### Scenario: Uncompressed size over 100MB fails
- **WHEN** cumulative uncompressed bytes for extracted members would exceed 100 MB
- **THEN** extract MUST fail closed and MUST NOT leave a successful oversize tree

### Requirement: Pack and Registry share the same extract policy
Pack archive extract (install-from-archive / unpack) and Registry archive materialize MUST apply the same safe-extract policy (shared helper or intentional twin with identical rules). Digest verification for registry packages (lk-013) MUST still run **before** extract and MUST NOT be weakened by this policy.

#### Scenario: Same rejection rules on both paths
- **WHEN** the same unsafe zip (path escape or symlink) is presented to Pack extract and to Registry materialize after a matching digest
- **THEN** both paths MUST fail closed under the same safety rules
