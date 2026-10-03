# P33 — Compliance Evidence, Audit Ledger & End-to-End Change Provenance

P33 is **active by explicit operator override** as an engineering phase.

It adds durable, reconstructable evidence above P29–P32. The goal is to answer:

> For a proposed, admitted, merged, promoted, rejected, rolled back or observed change, can we reconstruct exactly what happened and which evidence justified it?

## Not an external compliance certification

P33 creates internal evidence, provenance and auditability.

It does **not** claim that THIEPN is SOC 2 certified, ISO 27001 certified, HIPAA compliant, GDPR certified, or externally audited merely because these controls exist.

External compliance depends on the applicable legal/organizational/technical controls and, where required, independent assessment.

## Current production attestation

Observed at `2026-10-03T21:52:18.112063Z`:

- project: `ACTIVE_HEALTHY`
- organization plan: `Free`
- migration: `20261003202015_hub_h12_h13_notes_projection`
- semantic schema fingerprint: `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`
- Edge Functions: **12**
- `gomoku-room` remains **v48**
- Gomoku Edge SHA: `f0493fe400876a8d52f394724d6e44644978d2028b890c912ec283fdc32154cd`
- cron jobs: **14**
- active registered apps: **7**

P32 recorded migration head `20261003105645_gomoku_p20_production_slos_error_budgets`.

That P32 observation remains historical evidence. P33 does not rewrite it. The new Hub migration is appended as a newer production observation.

## Current Supabase audit capability

P33 rechecked audit capability against current Supabase documentation and production state.

Current state:

- organization plan: **Free**
- Supabase Platform Audit Logs: unavailable on the current plan
- current documentation: Platform Audit Logs are available on **Team and Enterprise** plans
- `auth.audit_log_entries`: **0 rows observed**
- `log_connections`: **off**
- `pgaudit`: **not installed**
- `pg_stat_statements`: installed
- `pg_cron`: installed

P33 does not change any of those settings.

It does not upgrade the organization, enable connection logging, install pgAudit, alter retention, or copy raw Auth audit rows into Git.

Those actions would be separate governed production/configuration/cost decisions.

## Canonical ledger

The canonical ledger is:

`platform-p33-audit-ledger.jsonl`

Each entry includes:

- schema version
- exact sequence
- unique event ID
- recording timestamp
- event type
- subject
- actor class/ID
- evidence source class
- previous-entry hash
- evidence object
- entry SHA-256

Entry hashes use canonical recursively sorted JSON and exclude only the `entryHash` field itself.

The initial ledger contains four entries:

1. P33 ledger genesis
2. imported reviewed Git lineage for P26–P32
3. current production live attestation
4. current audit-capability snapshot

## Reviewed head anchor

Hash chaining alone has an important limitation: deleting the last entry can leave the remaining chain internally valid.

P33 therefore adds a **reviewed head anchor**:

`platform-p33-ledger-anchor.json`

It records:

- expected entry count
- expected head sequence
- expected head event ID
- expected head hash
- SHA-256 of the complete ledger file
- source-main commit
- hash algorithm

Verification checks both the chain and this anchor.

This means P33 detects:

- historical entry modification
- middle-entry deletion
- reordering
- broken previous hashes
- sequence gaps
- duplicate event IDs
- invalid entry hashes
- **tail truncation**
- anchor/ledger mismatch

This is tamper evidence, not physical immutability. Git remains mutable by sufficiently privileged actors, so reviewed Git history remains part of the trust model.

## Append-only corrections

Existing ledger entries are never edited to correct history.

A correction is a new entry with:

- `eventType: correction`
- a new event ID
- a new timestamp
- `evidence.supersedesEventId` referencing an existing event

The append tool verifies the current ledger and anchor before accepting a new event.

It then:

1. preserves every existing ledger byte
2. appends the new entry
3. computes its chain hash
4. emits a new reviewed head anchor

A correction that references a nonexistent event is rejected.

## Evidence privacy

The canonical Git ledger is deliberately metadata-oriented.

P33 rejects sensitive raw evidence keys during append and policy forbids storing:

- access tokens
- refresh tokens
- service-role keys
- database passwords
- raw IP addresses
- raw user-agent strings
- raw Auth audit payloads
- user email addresses unless separately justified and approved

Permitted evidence includes:

- aggregate row/status counts
- timestamps/ranges
- non-personal resource identifiers
- Git and workflow IDs
- cryptographic hashes
- policy/certificate IDs

The audit system must not become a second store of sensitive operational data.

## Evidence source classes

P33 labels source origin rather than mixing all evidence together.

### `github_source`

Examples:

- commit SHA
- pull request
- workflow run
- job conclusion
- artifact checksum

### `supabase_live`

Examples:

- project health
- migration head
- semantic schema fingerprint
- Edge version/SHA
- cron count

### `supabase_native_audit`

Examples:

- Auth audit logs
- Platform Audit Logs when available
- Postgres logs

Availability and retention remain plan/configuration dependent.

### `human_approval`

Examples:

- production approval
- cost approval
- policy exception approval
- incident/recovery decision

### `derived_policy`

Examples:

- P32 admission receipt
- P31 release decision
- P30 promotion receipt
- P29 compatibility certificate

Derived evidence is never represented as if it were a raw provider audit event.

## P26–P32 governance history

The ledger imports reviewed Git references for:

- P26 — `01f40c2ee4feaecd204bf5b87d6a79ac81da90a2`
- P27 — `f4e9c2f23a799426ea3a60046094df5436947ab9`
- P28 — `85f23ea62b6bd874100ba4d9a158bd9574431312`
- P29 — `2c1bd74dfab8c45425054e552ba92bc65713c6b5`
- P30 — `dd35a66826471b4cd94c1b9e8ead90be18dc1dc5`
- P31 — `fd0f541fef82539c75ce3c4b429a222b4a20663f`
- P32 — `0e7e48c57cc505ec0d42dcc706e364763b8e8c63`

This is an imported lineage event, not a rewrite of historical P26–P32 files.

## P32 governance provenance

P33 includes one concrete end-to-end governance provenance example for merged P32.

Exact identity:

- PR: **#23**
- branch head: `3a7f34109b481af0a7bab3affc9e23e734c3d513`
- merge commit: `0e7e48c57cc505ec0d42dcc706e364763b8e8c63`

Verified workflows:

- CI run **784** / run ID `37123067111`
- P32 Change Admission Warn run **1** / run ID `37123067138`
- A7 / P25 Operations Contract run **456** / run ID `37123067132`

The provenance pack also binds predecessor governance:

- P29 merge
- P30 merge
- P31 merge
- P32 merge

and hashes the governing P29/P30/P31/P32 artifacts.

## Provenance packs

`scripts/p33-build-provenance.py` creates deterministic evidence packs.

A pack requires:

- change ID and subject
- exact 40-character Git commit SHA
- repository identity
- exact workflow run identities and conclusions
- P29–P32 chain references
- ledger path
- reviewed ledger anchor
- required artifact list
- explicit privacy declaration

For each artifact, P33 records:

- logical name
- path
- evidence kind/source class
- SHA-256
- byte size

Artifacts are sorted by logical name before the pack root is calculated.

The pack also binds the actual ledger bytes and reviewed anchor.

A copied anchor beside a different ledger therefore fails.

## Provenance root

The final `rootHash` is SHA-256 over the canonical provenance pack excluding the root hash itself.

It changes if any bound input changes, including:

- artifact bytes
- workflow identity
- commit identity
- cross-phase chain reference
- live attestation
- ledger head
- ledger bytes
- approvals
- privacy declaration

Mutable URLs alone are not treated as sufficient evidence.

## Failure rules

Provenance creation fails for:

- missing required artifact
- duplicate logical artifact name
- malformed/missing Git commit identity
- missing workflow identity
- missing P29/P30/P31/P32 chain reference
- ledger/anchor mismatch
- missing anchor
- raw-secret declaration
- raw personal-audit declaration
- raw network-identifier declaration

## Retention policy

Current internal minima:

- governance receipts: **730 days**
- release certificates: **730 days**
- admission decisions: **365 days**
- production attestations: **365 days**
- exception records: **730 days**
- minimized incident evidence: **730 days**
- transient workflow artifacts: **90 days**

Workflow artifacts are convenience copies, not the canonical evidence source.

Provider-native log retention remains plan dependent.

## Relationship to P29–P32

P33 does not replace earlier controls.

- P29 proves dependency/compatibility scope.
- P30 proves candidate/promotion/rollout state.
- P31 coordinates fleet-wide release eligibility.
- P32 decides whether a proposed change may enter the governed release flow.
- P33 records and connects the evidence those phases produce.

The goal is defense in depth plus reconstructability.

## Automation boundary

P33 may:

- verify the ledger
- verify the reviewed head anchor
- append a new ledger event to a generated output
- emit a replacement anchor for review
- hash artifacts
- build deterministic provenance packs
- run tamper/privacy tests

P33 may not:

- rewrite existing ledger events
- mutate production
- enable Supabase logging
- install pgAudit
- upgrade the Supabase plan
- claim external compliance certification

The P33 workflow is read-only with respect to repository contents and production.
