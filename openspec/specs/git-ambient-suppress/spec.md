# git-ambient-suppress Specification

## Purpose

Defines git and related transport-child credential isolation for OpenAPM sc-013 and SHOULD sc-008: suppress ambient platform token environment and inherited Auth git config, attach only the selected host-class credential, and refuse credential attach on non-https git-over-HTTP except loopback or explicit insecure exemption.

## Requirements

### Requirement: Ambient platform tokens suppressed on git children
Before every consumer git child process used for fetch or validate (including Resolver download/ref resolution, marketplace Authoring check, and PackOutputs remote resolve), the system MUST actively suppress ambient platform credential environment variables for unselected classes (at least GitHub, GitLab, and ADO token env names documented by the Auth module) on the **child** environment. Inherited Authorization / `http.extraheader` git configuration that would leak another class’s material MUST be cleared or overridden for that child. Process-global `process.env` for the parent CLI MAY remain unchanged.

#### Scenario: Unselected GITHUB_TOKEN not inherited by git child
- **WHEN** `GITHUB_TOKEN` is set in the parent environment and the selected class for the git remote is ado
- **THEN** the git child environment MUST NOT expose the GitHub token value for inheritance by git helpers

#### Scenario: Inherited http.extraheader cleared for child
- **WHEN** the parent environment would cause git to send an inherited Authorization extraheader for an unselected class
- **THEN** the child env construction MUST clear or override that inherited Auth material before spawn

### Requirement: Only selected-class credentials attach to git children
After ambient suppress, the system MUST attach at most the selected-class credential material to the git child (or attach nothing when none is available). Credentials for other classes MUST NOT resolve, attach, or inherit onto that child.

#### Scenario: Selected class credential attached only
- **WHEN** both GitHub and ADO tokens are present and overlap precedence selects ado for the remote host
- **THEN** the git child MUST receive ado-class credential material only and MUST NOT receive GitHub-class attach

### Requirement: Refuse non-https git-HTTP credential attach
The system MUST refuse attaching a credential to a git-over-HTTP URL whose scheme is not `https://`, unless the host is loopback (`127.0.0.0/8` or `::1`) or an applicable registry `insecure: true` exemption covers the URL. Refusal MUST still suppress ambient tokens for that child so unselected secrets do not leak via inheritance.

#### Scenario: http remote does not get token attach
- **WHEN** a consumer git fetch/validate targets `http://example.com/org/repo.git` and no loopback/`insecure` exemption applies
- **THEN** the system MUST NOT attach a credential for that URL and MUST still suppress ambient platform token env on the child

#### Scenario: https remote may attach selected class
- **WHEN** a consumer git fetch/validate targets an `https://` remote and a selected-class credential exists
- **THEN** the system MAY attach that selected-class credential after ambient suppress

#### Scenario: Loopback http exempt from refuse
- **WHEN** a git-over-HTTP URL uses host `127.0.0.1` or `::1` with scheme `http://`
- **THEN** the non-https refuse MUST NOT block attach solely due to scheme
