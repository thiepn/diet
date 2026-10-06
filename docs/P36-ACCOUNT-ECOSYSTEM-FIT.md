# P36 — THIEPN Account & Ecosystem Fit

P36 makes Diet Copilot behave like a deliberate THIEPN Account consumer without replacing the stable Diet auth implementation.

## Account boundary

Diet Copilot remains one of the explicitly permitted `certified-legacy` Account Platform consumers.

P36 does **not** migrate Diet to the shared Account Browser SDK just to satisfy visual consistency. The existing Diet PKCE/session path already carries the same authority and storage invariants and remains protected by the A7/A8/A9 regression gates.

Canonical identity and security authority remain **THIEPN Account**. Diet Copilot remains the owner of Diet-specific nutrition records, strategy state and food history.

## Account-state UX

The Account dialog now distinguishes:

- checking account state;
- signed in;
- signed out;
- account/service temporarily unavailable.

A service/network failure is no longer presented as a sign-out. Diet preserves local/cached state and offers a retry path.

Public UI also stops exposing raw backend/auth error text for the generic stale/error banner. Internal telemetry retains operational classifications without copying sensitive token material.

## Session semantics

Ordinary Diet sign-out remains explicit **local sign-out**:

- the control is labeled **Sign out of Diet**;
- the dialog explains that the session is for this Diet app;
- the implementation continues to call Supabase sign-out with `scope:'local'`.

P36 does not claim global SSO reuse, instant cross-origin logout or a shared browser session across Account, Hub and Diet.

## Ecosystem navigation

The normal Diet account surface now exposes two first-class destinations:

- **Manage THIEPN Account** → `https://account.thiepn.dev/`
- **Return to Hub** → `https://thiepn.dev/home/`

The More page also exposes THIEPN Hub directly.

Cross-app links suppress referrer information with `no-referrer`.

## Legacy cleanup

The Account dialog no longer exposes **Open legacy v1**.

The certified V1 rollback bundle remains in the repository and service-worker release boundary for recovery purposes, but it is no longer presented as a normal user destination.

## Account Platform metadata

The consumer manifest now records:

- P36 account-consumer UI phase;
- canonical Account and Hub destinations;
- unavailable-vs-signed-out behavior;
- explicit local sign-out;
- hidden raw backend errors;
- normal Account/Hub navigation;
- absence of the legacy-v1 Account entry.

The Account release sidecar records P36 as the current consumer-integration phase while retaining Account Platform 1.0 / contract 1.0 compatibility.

## Performance

P36 keeps the fixed raw core asset ceiling at **750,000 bytes**.

The account/ecosystem UI is funded by compacting inter-tag whitespace in the production root HTML only. No feature or runtime behavior is removed.

Observed P36 raw core size: **742,238 bytes**.

## Boundaries

P36 does not:

- create a second identity authority;
- move Diet to a new Supabase project;
- copy access or refresh tokens between apps;
- add password auth;
- migrate certified-legacy Diet to SDK 1.x;
- claim Account-local sign-out logs out Diet or Hub;
- add Hub private data reads;
- add database migrations or new writes.

## Next phase

**P37 — Real-World Usage Hardening**
