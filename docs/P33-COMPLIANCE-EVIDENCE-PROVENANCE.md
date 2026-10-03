# P33 — Compliance Evidence, Audit Ledger & End-to-End Change Provenance

P33 is **staged, not active**.

Dependency chain:

**P25 → P26 → P27 → P28 → P29 → P30 → P31 → P32 → P33**

P33 answers a different question from P32:

> After a change was proposed, admitted, tested, promoted, observed or rejected, can we reconstruct exactly what happened from durable evidence?

The answer must be deterministic and must not depend on someone's memory or on a dashboard screen that later changes.

## Not a compliance certification

P33 creates internal control evidence and auditability.

It does **not** claim that THIEPN is SOC 2, ISO 27001, HIPAA, GDPR-certified, or compliant with any external framework merely because these files exist.

External compliance requires the applicable organizational, legal and technical controls plus independent assessment where relevant.

## Latest live attestation

P33 rechecked production.

Current observation:

- project: `ACTIVE_HEALTHY`
- migration: `20261001183709_gomoku_p13_reliability_heartbeat`
- semantic schema SHA: `0b60c48fd0aef1e33a17c6c18914c6a7357044f6026a6f2c3d3b34a51bcc6794`
- `gomoku-room`: **v39**
- Edge SHA: `c31ace5fddf56de22aa94a4b6e1887b1245c5dc713c7c90696f739c9c82fd95b`
- cron jobs: **11**

P32's P12/v38 snapshot is therefore historical evidence, not current truth.

P33 does not rewrite old evidence. It appends new observations.

## Audit evidence capability

Current Supabase evidence capability was measured rather than assumed:

- organization plan: Free;
- Supabase Platform Audit Logs: unavailable on the current plan according to current Supabase documentation;
- `auth.audit_log_entries`: 0 rows observed;
- `log_connections`: off;
- `pgaudit`: not installed;
- `pg_stat_statements`: installed;
- `pg_cron`: installed.

P33 does **not** enable logging, install extensions or upgrade the plan. Those would be production/configuration/cost changes that must pass P32–P31 governance.

## Canonical audit ledger

`platform-p33-audit-ledger.jsonl` is the reviewed canonical ledger.

Each line is a complete JSON entry containing:

- monotonically increasing sequence;
- unique event ID;
- timestamp;
- event type;
- subject;
- actor class/identifier;
- previous-entry hash;
- evidence payload;
- current entry SHA-256.

The hash is computed from the canonical JSON form of the entry excluding `entryHash`.

The first entry is the genesis entry. Every later entry must reference the previous entry's exact hash.

## Tamper evidence, not magical immutability

A SHA-256 chain makes unauthorized rewriting detectable when compared against trusted Git history/reviewed commits.

It does not make a mutable Git repository physically immutable.

P33 therefore combines:

- hash-linked entries;
- reviewed Git history;
- exact commit identities;
- workflow/run identities;
- artifact checksums.

Existing ledger events are never edited to correct history.

A correction is a **new appended event** referencing the superseded event.

## Provenance packs

`scripts/p33-build-provenance.py` builds an evidence pack from explicitly required artifacts.

A pack contains:

- repository;
- exact commit SHA;
- PR number when applicable;
- exact workflow/run identity;
- live attestation;
- approvals;
- sorted artifact list;
- SHA-256 + size of every artifact;
- privacy declaration;
- deterministic root hash.

Mutable URLs alone are insufficient evidence.

Missing required evidence causes pack creation to fail.

## End-to-end release provenance

A complete governed release should be reconstructable through:

1. change manifest;
2. P32 admission decision;
3. P29 impact analysis / compatibility certificate when applicable;
4. P30 immutable candidate and promotion decision;
5. P31 fleet-wide `can-release` decision;
6. required human approvals;
7. exact deployment/workflow identity;
8. post-deployment live attestation;
9. final release certificate, abort, rollback or failure record.

Every layer keeps its own evidence; P33 connects and hashes it.

## Evidence source classes

P33 distinguishes evidence origin.

### GitHub/source evidence

Examples:

- commit SHA;
- PR;
- workflow run;
- job conclusion;
- artifact hash.

### Supabase live evidence

Examples:

- project health;
- migration head;
- semantic schema fingerprint;
- Edge version/SHA;
- cron inventory;
- advisor result.

### Supabase-native audit evidence

Examples:

- Auth audit logs;
- Platform Audit Logs where the plan supports them;
- Postgres logs.

Provider retention and feature availability remain plan/config dependent.

### Human approval evidence

Examples:

- production approval;
- cost approval;
- exception approval;
- destructive recovery decision.

### Derived evidence

Examples:

- P32 admission;
- P31 release decision;
- P30 promotion decision;
- P29 compatibility certificate.

Derived policy evidence is never presented as if it were a raw provider log.

## Privacy

Git-based evidence is deliberately metadata-oriented.

P33 forbids storing in canonical evidence:

- access/refresh tokens;
- service-role keys;
- DB passwords;
- raw IP addresses;
- raw user-agent strings;
- raw Auth audit payloads;
- user email addresses unless a separate explicit need and approval exists.

Permitted evidence includes aggregate counts, timestamps/ranges, status counts, non-personal resource IDs and cryptographic hashes.

This prevents an audit system from becoming a second sensitive-data store.

## Retention

Suggested internal evidence minima:

- release certificates: 730 days;
- admission decisions: 365 days;
- production attestations: 365 days;
- exceptions: 730 days;
- incident evidence: 730 days with minimization;
- transient workflow artifacts: at least 30 days, but they are not canonical.

Provider-native log retention remains plan dependent.

## Verification

`scripts/p33-ledger.py verify` detects:

- modified historical entries;
- deleted entries;
- reordered entries;
- broken previous-hash links;
- sequence gaps;
- duplicate event IDs;
- invalid entry hashes.

`scripts/p33-ledger.py append` refuses to append to an invalid chain.

## Activation

P33 remains `staged_pending_p32`.

It cannot become the canonical production evidence process until P32 is certified and at least one complete governed release has been captured end-to-end.
