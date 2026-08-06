# docs-openapm-boundary Specification

## Purpose

Defines reader-facing documentation that separates OpenAPM v0.1 conformance claims from microsoft/apm product CLI parity and records cursor-only host posture with discoverable links into the published conformance statement.

## Requirements

### Requirement: Root README Conformance & parity section

The repository root README MUST include a short section titled Conformance & parity (or an equivalent stable heading) that: (1) links to root `CONFORMANCE.md` (and MAY also link `CONFORMANCE.json`); (2) states the claimed OpenAPM v0.1 classes as Consumer, Producer, and Governance with Registry N/A; (3) states that bapm targets the OpenAPM v0.1 wire and is not a drop-in clone of every microsoft/apm CLI command or adapter; (4) points to at least the intentional diffs ∩-pick vs APM first-wins, cursor-only deploy matrix, and dual-read branding.

#### Scenario: README links CONFORMANCE and states classes

- **WHEN** a reader opens the root README
- **THEN** the Conformance & parity section MUST contain a link to `CONFORMANCE.md` and MUST name Consumer, Producer, and Governance as claimed with Registry N/A

#### Scenario: README denies drop-in APM CLI parity

- **WHEN** a reader reads the Conformance & parity section
- **THEN** the text MUST state that bapm is not a drop-in replacement for the full microsoft/apm product CLI surface

#### Scenario: README lists intentional diffs

- **WHEN** a reader reads the Conformance & parity section
- **THEN** the text MUST mention ∩-pick (vs APM first-wins), cursor-only targets, and dual-read branding as intentional differences

### Requirement: Dedicated docs-site conformance boundary page

The VitePress docs site (`apps/docs`) MUST publish a dedicated guide page (not only an architecture subsection) that is reachable from site navigation and that documents three axes: OpenAPM v0.1 wire conformance (claimed classes), microsoft/apm product CLI (not full parity), and host targets (cursor-only today; multi-target later). The page MUST link to root `CONFORMANCE.md` and MUST list out-of-scope items aligned with CONFORMANCE Limitations. After the marketplace floor ships, the page MUST NOT list marketplace/plugin as an absolute out-of-scope blanket; residual OpenAPM §10 security deferrals (host-class/auth, approve/deny UX, soft archive gaps) MUST be framed as security-depth limitations, not as marketplace OOS.

#### Scenario: Dedicated page is navigable

- **WHEN** a reader opens the docs site sidebar or guide nav
- **THEN** a dedicated conformance / OpenAPM boundary page MUST be linked (e.g. under Guide)

#### Scenario: Page states three axes and links CONFORMANCE

- **WHEN** a reader opens the dedicated conformance boundary page
- **THEN** the page MUST describe OpenAPM claim vs APM product CLI vs cursor-only hosts and MUST include a link path to root `CONFORMANCE.md`

#### Scenario: Page lists out-of-scope aligned with Limitations

- **WHEN** a reader reads the out-of-scope portion of that page after marketplace floor honesty
- **THEN** multi-target (later) and registry host MUST appear as out of scope, and marketplace/plugin MUST NOT appear as an absolute out-of-scope blanket for residual `sc-*` skips

#### Scenario: Residual security gaps disclosed on guide page

- **WHEN** a reader reads the out-of-scope or limitations-aligned portion of that page
- **THEN** residual §10 security-depth deferrals (host-class/auth and/or approve/deny UX, or equivalent accurate wording) MUST be disclosed

### Requirement: Docs site must not market multi-client adapters as shipped

Landing, guide introduction, and architecture overview pages MUST NOT imply that Copilot, Claude, or other non-cursor client adapters are shipped in-tree. They MUST describe materialization via target packages with cursor-only as the current host matrix (multi-target later).

#### Scenario: Landing no longer advertises multi-client adapters as present

- **WHEN** a reader opens the docs landing page
- **THEN** the page MUST NOT list Copilot/Claude (or equivalent multi-client) adapters as current shipped surfaces without qualifying them as out of scope or later

#### Scenario: Architecture describes target packages not in-tree adapters

- **WHEN** a reader opens the architecture overview
- **THEN** the page MUST describe host materialization via target packages (cursor-only today) and MUST NOT claim in-tree multi-client adapters inside `@bapm/core` as the current design

### Requirement: CONFORMANCE discoverability without coverage hand-edits

Human-facing surfaces (root README and the dedicated docs page) MUST deep-link readers into the published conformance statement, including its Limitations / non-conformance content. Any optional generator note or related-docs line MUST be produced via the conformance generator inputs/outputs so that coverage tables are not hand-edited and `conformance:check` remains green.

#### Scenario: Cross-links reach Limitations without editing coverage rows by hand

- **WHEN** apply updates documentation or generator-related notes for discoverability
- **THEN** per-requirement coverage tables MUST remain generator-owned and MUST NOT be hand-edited for this change

### Requirement: Knowledge topics reflect closed docs boundary

Local knowledge topics that track parity/conformance roadmap MUST be updated so that P4 Governance is claimed/done, P5 documents the OpenAPM vs APM CLI vs cursor-only boundary, and the OpenAPM floor track is closed after P5 without contradicting the published statement (no “Governance forever floor” wording).

#### Scenario: Roadmap marks P5 as the docs close-out

- **WHEN** knowledge roadmap / parity / conformance map topics are read after apply
- **THEN** they MUST show P4 done with Governance claimed and MUST describe P5 as docs-boundary close-out (not a product-feature stage)
