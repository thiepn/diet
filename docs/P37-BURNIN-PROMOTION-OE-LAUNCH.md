# P37 — Burn-In Certification, Governance Stack Promotion & Operating-Effectiveness Launch

P37 is **staged, not active**.

P37 is the first phase allowed to convert the long P26–P36 governance stack from staged artifacts into active operations. It is intentionally fail-closed: burn-in certification comes first, promotion is strictly sequential, and the operating-effectiveness clock starts only after the final activation observation.

## Current production state

P25 generation 2 remains the active operations release.

Frozen generation-2 epoch:

- migration: `20261002095255_gomoku_p16_certification_null_fix`
- semantic schema SHA: `af9cc4acbed9e61bc81f48642f75b1c2e2841ebdf52a5139f14e784e509aecad`
- `gomoku-room`: v42
- Edge SHA: `fc63d31db8a51b860fc45aa7148fc864f8b2622fc469e495123e9a950273687d`
- cron: 11/11 active
- latest live staging check: `2026-10-02T15:13:34.929055Z`
- cron failures in the observed 24h window: 0

The earliest possible P25 generation-2 certification remains:

`2026-10-03T14:32:00.744993Z`

At the P37 staging observation there were **0 qualifying** dedicated P25 workflow samples after the freeze, so certification is impossible today.

## Sampling reliability correction

The original nominal hourly GitHub schedule was observed to deliver far fewer runs than requested.

A separate production-safe prerequisite patch was therefore merged to `main`:

`2c646ee61a361dbd1d8bb27713cd309b8fd697fb`

It preserves the original `17 * * * *` trigger and adds `7,27,47 * * * *`.

This changes only evidence-collection opportunity density. It does not change:

- the frozen database epoch;
- the P25 health probe;
- the 24-hour minimum;
- the requirement for at least 12 successful samples;
- the required evidence span.

P26–P36 were resynchronized with that main commit before P37 was staged.

## Burn-in certification

`scripts/p37-certify-burnin.py` will not certify P25 generation 2 unless all release identity and operational checks still pass.

In addition to at least 12 successful healthy P25 samples, P37 requires **six 4-hour coverage buckets** across the first 24 hours and a terminal successful sample at or after the 24-hour boundary.

This prevents twelve clustered samples near the end of the window from being presented as a 24-hour observation period.

The final certification also requires:

- exact frozen migration/schema/Edge/cron identity;
- project `ACTIVE_HEALTHY`;
- P18 clean;
- P20 drift false;
- P21 pass;
- P22 pass;
- zero unexplained cron failures;
- no blocking replication slot;
- successful encrypted backup after the last shared change;
- current cross-app smoke pass;
- all required Edge Functions active;
- Auth, Realtime, PostgREST and Storage health;
- Security and Performance Advisor review;
- zero PostgreSQL 17.11 compatibility hazards.

Any frozen-epoch change invalidates the certificate.

## Governance-stack promotion

Promotion order is immutable:

**P26 → P27 → P28 → P29 → P30 → P31 → P32 → P33 → P34 → P35 → P36**

The manifest is `contracts/p37-governance-promotion-manifest.json`.

P37 forbids batch promotion. For each phase:

1. the previous phase must already have a complete merge receipt;
2. the candidate branch is synchronized to the current `main`;
3. its expected head SHA must match the manifest;
4. full candidate CI must pass on that synchronized head;
5. the draft is marked ready immediately before promotion;
6. exactly one PR is squash-merged;
7. the receipt records pre-merge main, merge commit and post-merge main;
8. the next phase is resynchronized to the resulting main;
9. the gate is rerun.

A broken receipt chain or an out-of-order merged phase blocks the stack.

The staged PR mapping is:

| Phase | PR |
| --- | ---: |
| P26 | #17 |
| P27 | #18 |
| P28 | #19 |
| P29 | #20 |
| P30 | #21 |
| P31 | #22 |
| P32 | #23 |
| P33 | #24 |
| P34 | #25 |
| P35 | #26 |
| P36 | #28 |

## P34-D001 risk treatment

Leaked-password protection is still not claimed as enabled. Supabase currently documents it as a Pro-plan-or-above feature.

P37 captured current aggregate Auth evidence:

- **11 Google identities**
- **11 total users**
- **0 users with a password hash**
- no non-Google identity provider currently represented
- 0 verified MFA factors

Because there is currently no password-auth population, P37 prepares a temporary, maximum-90-day treatment for P34-D001 rather than silently purchasing Pro or falsely closing the underlying product limitation.

The treatment is fail-closed. It reopens immediately if:

- any user acquires a password hash;
- email/password authentication is introduced;
- a non-reviewed password sign-in path appears;
- Supabase makes the protection available on the current plan and it remains disabled without review;
- a password-auth/credential-stuffing incident occurs.

The planned treatment expires no later than `2026-12-31T15:00:00Z`.

It is not permanent closure and it does not authorize a paid-plan upgrade.

## Governance activation target

The staged P32 bundle remains in shadow mode today. P37 is the separate reviewed activation phase required by P32.

After P26–P36 are fully promoted, P37 may activate:

- P32 mode: **warn**
- P33 canonical evidence process: **active**
- P34 control catalog: frozen at `2026-10-02.1`
- P34-D006: closed by certified stable burn-in
- P34-D001: time-bounded risk treatment active, only while its live conditions remain true

P32 is intentionally moved to `warn` first rather than jumping directly from shadow to enforce.

## Operating-effectiveness launch

`scripts/p37-build-oe-launch.py` requires:

- certified P25 generation 2;
- complete, ordered P26–P36 promotion receipts;
- P32 at warn/enforce/production;
- active P33 canonical evidence;
- frozen P34 control catalog;
- evidence-collection dry-run pass;
- zero critical open deficiencies;
- P34-D006 closed;
- all high deficiencies remediated or formally dispositioned;
- active, unexpired D001 treatment with zero password-auth users.

The OE period is **not backdated**.

Its start timestamp is the final successful governance activation observation after the stack has been promoted. From that timestamp:

- internal dry-run minimum: 30 calendar days;
- external-readiness planning target: 90 days;
- no external attestation is claimed.

## Current P37 state

P37 remains `staged_waiting_p25_generation2`.

Nothing in the staged P37 branch changes production, RLS, database functions, Auth settings, billing, Edge Functions, cron or Supabase infrastructure.

The next execution checkpoint is after `2026-10-03T14:32:00.744993Z`, when P37 can re-evaluate the real generation-2 sample population and live frozen epoch.
