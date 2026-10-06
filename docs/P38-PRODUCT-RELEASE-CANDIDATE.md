# P38 — Product Release Candidate

P38 closes the Diet Copilot product-build track and certifies the current **2.0.3 stable production artifact** as the product release candidate.

“Release candidate” here describes product-completeness certification. It does **not** downgrade the already-live stable channel to a prerelease build, add an RC badge, or create a parallel runtime.

## Frozen runtime

The P38 application runtime is the exact P37 runtime.

- public release: **2.0.3**
- release channel: **stable**
- visible badge: **2.0**
- visible state: **Production**
- runtime phase: **P37**
- production cache generation: **P37**
- raw core size: **749,788 / 750,000 bytes**

P38 adds no application JavaScript, CSS, database migration, RPC, nutrition logic or product screen.

Any future product change must be treated as a new scoped change rather than silently extending P38.

## Release blocker found and repaired

The post-P37 audit found that **P21 Full Failure & Recovery Certification** was failing in Chromium even though Firefox, WebKit, the public failure matrix and the application itself were healthy.

The failure was a stale historical browser assertion hard-coded to:

`diet-copilot-prod-v2-p17-1`

while production correctly installed:

`diet-copilot-prod-v2-p37-1`

P38 changes the live P21 test to derive the expected cache name from the checked-out `sw.js`. Future cache rotations therefore cannot create the same false production failure.

## Historical RC automation

The old P11 RC certification workflow described the pre-production `/diet/v2/` candidate period.

It is no longer allowed to automatically recertify the modern stable production deployment. P38 converts it to a manual historical record.

The old P11 evidence scripts remain in the repository as historical artifacts.

## Static candidate gate

`tests/p38-product-release-candidate-contract.mjs` verifies:

- 2.0.3 remains stable;
- no public RC marker is introduced;
- no unfinished `data-coming` controls remain;
- normal Account UI does not expose legacy v1;
- P37 remains the frozen runtime;
- the 750 KB raw-core ceiling remains intact;
- P21 follows the current service-worker cache dynamically;
- historical P11 automation is retired;
- P38 release metadata and maintenance state are internally consistent.

## Exact public deployment gate

After a P38-relevant commit reaches `main`, the P38 workflow waits for GitHub Pages to converge.

It compares the public bytes at `https://thiepn.dev/diet/` against the exact checkout for:

- root production HTML and manifest;
- service worker;
- all `v2/` runtime files;
- Account/application manifests;
- vendor Supabase runtime;
- icon assets;
- certified legacy rollback bundle.

The release is not publicly certified until every compared asset matches the merged commit byte-for-byte.

## Three-browser production acceptance

After deployment convergence, Playwright certifies the public app in:

- Chromium;
- Firefox;
- WebKit.

The live checks cover:

- stable title/badge and Production marker;
- all five primary routes;
- absence of unfinished coming-soon controls;
- Account and Hub handoffs;
- absence of legacy-v1 control in normal Account UX;
- P37 hardening runtime availability;
- clean write guard and owner-model invariant in a clean browser;
- unsaved-edit protection;
- compatibility alias;
- legacy rollback route;
- 390 × 844 mobile layout and touch targets;
- horizontal-overflow protection;
- Chromium service-worker ownership;
- current service-worker cache installation;
- offline shell reload;
- reconnect recovery;
- absence of page runtime errors.

## Authenticated-path boundary

P38 does not store a production test-user password, Google credential or reusable authenticated browser state in GitHub.

Authenticated data safety is instead covered by the existing Account contract, RLS/owner-isolation, mutation, privacy, concurrency, integrity, recovery and operational certifications.

The public live-browser suite therefore tests the clean signed-out/degraded/public surface without weakening account security just to automate a login.

## Acceptance stack

P38 requires the existing stack to remain green:

- CI/product contracts through P38;
- A7 operations;
- A8 Account consumer contract;
- A9 Account Platform v1;
- production security;
- encrypted off-site backup;
- performance;
- privacy/lifecycle;
- data integrity;
- concurrency/idempotency;
- change governance;
- full failure/recovery certification;
- maintenance/supply-chain;
- shared-platform readiness;
- controlled-upgrade state;
- post-upgrade burn-in;
- GitHub Pages deployment;
- P38 exact-deployment and three-browser certification.

## Maintenance state

After P38, Diet Copilot enters **defect-only maintenance**.

Permitted work:

- verified defects;
- security/privacy fixes;
- dependency/platform compatibility;
- operational reliability;
- accessibility regressions;
- performance regressions;
- explicitly approved new product requirements.

P38 is not an invitation to continue adding phases for their own sake.

## Result

The product-build roadmap P27–P38 is complete once the P38 branch is merged and its post-deployment production certification passes.
