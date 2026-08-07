## ADDED Requirements

### Requirement: Document bapm `local` source as intentional extension

Reader-facing documentation MUST describe object-form `local` on APM dependency entries as a **bapm extension** over OpenAPM `path:`: default root `.agents/local`, optional custom path, and the gitignore / untracked ensure behavior. Docs MUST state that OpenAPM `path:` remains the portable wire form and MUST NOT present `local` as an OpenAPM v0.1 requirement or as full microsoft/apm CLI parity.

#### Scenario: Manifest guide documents local

- **WHEN** a reader opens the VitePress manifest / config guide
- **THEN** the page MUST document `local` (default and custom) and MUST contrast it with OpenAPM `path:`

#### Scenario: Conformance boundary names local as bapm-only

- **WHEN** a reader opens the dedicated conformance / OpenAPM boundary page (or the root README intentional-diffs list)
- **THEN** the text MUST mention the bapm `local` source extension among intentional differences (or explicitly as a bapm-only extension), without claiming it as OpenAPM wire vocabulary

## MODIFIED Requirements

### Requirement: Root README Conformance & parity section

The repository root README MUST include a short section titled Conformance & parity (or an equivalent stable heading) that: (1) links to root `CONFORMANCE.md` (and MAY also link `CONFORMANCE.json`); (2) states the claimed OpenAPM v0.1 classes as Consumer, Producer, and Governance with Registry N/A; (3) states that bapm targets the OpenAPM v0.1 wire and is not a drop-in clone of every microsoft/apm CLI command or adapter; (4) points to at least the intentional diffs ∩-pick vs APM first-wins, cursor-only deploy matrix, dual-read branding, and the bapm-only `local` dependency source (vs OpenAPM `path:`).

#### Scenario: README links CONFORMANCE and states classes

- **WHEN** a reader opens the root README
- **THEN** the Conformance & parity section MUST contain a link to `CONFORMANCE.md` and MUST name Consumer, Producer, and Governance as claimed with Registry N/A

#### Scenario: README denies drop-in APM CLI parity

- **WHEN** a reader reads the Conformance & parity section
- **THEN** the text MUST state that bapm is not a drop-in replacement for the full microsoft/apm product CLI surface

#### Scenario: README lists intentional diffs

- **WHEN** a reader reads the Conformance & parity section
- **THEN** the text MUST mention ∩-pick (vs APM first-wins), cursor-only targets, dual-read branding, and the bapm `local` source extension as intentional differences
