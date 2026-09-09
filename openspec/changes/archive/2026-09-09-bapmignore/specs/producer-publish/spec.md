## ADDED Requirements

### Requirement: Publish archive honors .bapmignore

When publish builds a flat registry zip from the project tree (not `--zip` upload of a prebuilt archive), the system MUST apply project-root `.bapmignore` rules defined by `pack-bapmignore` to optional root docs and to files collected under `.apm/`. Patterns MUST NOT prevent emission of wire root `apm.yml` from the dual-read base manifest. Personal overlay/lock omit and experimental-gate/upload semantics MUST remain unchanged. `--zip` MUST continue to upload the given bytes without re-applying `.bapmignore` to the prebuilt archive contents.

#### Scenario: Publish omits ignored README

- **WHEN** publish builds an archive from a valid project that has root `README.md` and `.bapmignore` matching `README.md`, with a non-empty packable `.apm/` after ignore
- **THEN** the flat zip MUST contain `apm.yml` and MUST NOT contain `README.md`

#### Scenario: Prebuilt --zip bypasses rebuild ignore

- **WHEN** `publish --zip <archive>` is invoked with a valid zip and the experimental gate enabled
- **THEN** the client MUST PUT those archive bytes without rebuilding from the project tree and without re-filtering members through `.bapmignore`
