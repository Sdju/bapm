## MODIFIED Requirements

### Requirement: Dedicated docs-site conformance boundary page

The VitePress docs site (`apps/docs`) MUST publish a dedicated guide page (not only an architecture subsection) that is reachable from site navigation and that documents three axes: OpenAPM v0.1 wire conformance (claimed classes), microsoft/apm product CLI (not full parity), and host targets (cursor-only today; multi-target later). The page MUST link to root `CONFORMANCE.md` and MUST list out-of-scope items aligned with CONFORMANCE Limitations. After the marketplace floor ships, the page MUST NOT list marketplace/plugin as an absolute out-of-scope blanket; residual OpenAPM §10 security deferrals MUST be framed as security-depth limitations, not as marketplace OOS. After sc-soft-security, residual wording MUST reflect that zip size/entry caps are present while tar.gz-only container format remains soft. After sc-executable-governance, residual wording MUST reflect that interactive user-local approve/deny is claimed. After sc-host-class, residual wording MUST reflect that OpenAPM §10.3 credential host-class floor (PSL ∪ aliases, redirect Auth drop, ambient suppress, https-only git-HTTP attach refuse) is claimed for covered consumer paths, MUST name residual Auth depth / soft zip honestly, and MUST NOT imply sc-004 is claimed active or that full §10.3 host-class remains wholly deferred.

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

- **WHEN** a reader reads the out-of-scope or limitations-aligned portion of that page after sc-host-class
- **THEN** residual §10 wording MUST name soft zip container vs tar.gz and any residual Auth depth without claiming sc-004 active, without framing claimed user-local approve as wholly OOS, and without framing claimed §10.3 host-class floor as wholly deferred
