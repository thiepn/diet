# Diet Copilot 2.0 — P11 Release Candidate Deployment & Real-Device Certification

Status: **public RC deployed and automated live certification complete; physical-device sign-off remains manual**

## Public RC

Diet Copilot 2.0 RC is published at:

\`https://thiepn.dev/diet/v2/\`

The production v1 entrypoint remains:

\`https://thiepn.dev/diet/\`

P11 does **not** replace the production v1 route.

Current deployed \`main\` head at P11 certification:

\`021d476dfc1978d08fa9ce58f78b000b0f7f2e3c\`

The \`v2/\` tree on \`main\` is byte-identical to the \`v2/\` tree on \`diet-copilot-2.0\`.

The archived v1.0.3 freeze remains byte-identical to:

\`d25728bd478e50c545855fb07c63a445575fa465\`

## Deployment boundary

Relative to the frozen v1.0.3 production commit, P11 adds:

- the complete \`v2/\` release-candidate subtree,
- P11 live-certification tests,
- P11 live-certification workflow,
- the narrow root \`sw.js\` isolation patch required to stop the v1 service worker from intercepting \`/v2/\`.

The v1 HTML/CSS/application bundle is not replaced.

## P11 blockers found and fixed

### 1. V2 could not sign in from a clean browser

Before P11, V2 could reuse an existing same-origin Diet session but exposed no standalone sign-in lifecycle for a clean/cleared browser.

P11 adds:

- **Continue with Google**
- local sign-out
- live-data refresh
- PKCE callback resolution
- V2-specific OAuth relay target
- callback-query cleanup
- canonical Supabase authorize-destination validation

V2 runtime marker:

\`2.0.0-p11-rc\`

### 2. OAuth relay required a V2-specific destination

The shared Wordstrike relay now understands:

\`web-v2\`

and routes that callback to:

\`/diet/v2/\`

Existing \`web\` and \`native\` behavior remains unchanged.

V2 uses the canonical production relay:

\`https://thiepn.dev/wordstrike/\`

rather than the legacy uppercase path.

### 3. PKCE verifier needed storage fallback

The long-lived Diet Auth session retains the existing resilient localStorage/cookie behavior.

The temporary PKCE verifier now falls back to tab-scoped \`sessionStorage\` when localStorage is blocked, quota-limited or silently fails.

This avoids making Google sign-in impossible in storage-restricted browsers while keeping long-lived authentication separate from sessionStorage.

### 4. A real-browser module parse defect existed

The first public P11 browser run exposed a release blocker in \`v2/data.js\`:

a generated source fragment contained literal \`\\n\` characters in executable JavaScript around the Today training-summary expression.

Node/source CI had not exposed the deployed browser failure.

Real Chromium/Firefox/WebKit execution did.

P11 fixed the source and added a regression asserting that \`v2/data.js\` cannot contain that literal source-corruption pattern.

This is the strongest practical reason the public-browser RC stage exists.

### 5. Cross-browser live test compatibility

The live P11 harness was hardened so the same certification can run in:

- Chromium
- Firefox
- WebKit

without relying on Chromium-only mobile emulation behavior.

### 6. Live-certification/deployment ordering

The initial public verifier could occupy a GitHub runner while waiting for Pages to deploy the commit it was checking.

P11 fixes the certification workflow so it can supersede stale runs and also certify Pages-completed commits.

Current public certification no longer depends on silently trusting a repository build.

## Automated public certification

Workflow:

\`.github/workflows/p11-rc-live.yml\`

Current successful run:

**P11 Live RC Certification #8**

Exact public-asset verification passed before browser checks.

The verifier compares the SHA-256 of every file in the checked-out \`v2/\` tree with the bytes served publicly at:

\`https://thiepn.dev/diet/v2/\`

### Chromium

Passed.

Checks include:

- RC title and marker
- five primary routes
- clean-browser account dialog
- standalone Google sign-in CTA
- production v1 root remains v1
- OAuth relay routes \`web-v2\` back to \`/diet/v2/\`
- sign-in initiation targets canonical Supabase \`/auth/v1/authorize\`
- 390 px mobile navigation remains one row
- Food shortcuts remain one horizontal row
- no page-level horizontal overflow
- dark theme applies
- dark theme persists reload
- V2 service-worker scope is \`/diet/v2/\`
- P11 V2 cache installs
- offline reload remains Diet Copilot 2.0
- offline reload never falls back to v1
- no page runtime errors

### Firefox

Passed.

Same browser/UI/auth-relay/mobile/theme checks that are applicable outside the Chromium service-worker/offline-specific block.

### WebKit

Passed.

Same browser/UI/auth-relay/mobile/theme checks that are applicable outside the Chromium service-worker/offline-specific block.

A mobile dark-theme screenshot is retained as a workflow artifact for every browser run.

## Existing production browser regression

The latest Account Browser Regression also passes on:

- Chromium
- Firefox
- WebKit

Its production-asset gate passes as well.

## GitHub Pages

Latest Pages deployment for the certified head:

**pages build and deployment #280 — success**

## Main CI

Latest CI for the certified head:

**CI #529 — success**

The full P1–P11 source/build suite remains green.

## Live database certification

P11 makes no new database schema or mutation-authority change.

The live canonical Supabase project still passes:

\`\`\`text
diet_p0_legacy_contract_ok
diet_p3_app_write_contract_ok
diet_p4_food_database_contract_ok
diet_p5_strategy_contract_ok
diet_p6_training_activity_contract_ok
diet_p7_personal_intelligence_contract_ok
diet_p8_ai_copilot_contract_ok
diet_p9_settings_data_contract_ok
diet_p10_release_candidate_contract_ok
\`\`\`

Therefore P11 does not expand the certified browser database authority.

The same 18 Diet mutation RPCs remain the browser write allowlist.

## PWA state

V2 remains independently scoped from v1.

Manifest:

\`v2/manifest.webmanifest\`

Service worker:

\`v2/sw.js\`

Registration:

\`v2/pwa.js\`

Current cache generation:

\`diet-copilot-v2-rc-p11-auth-1\`

Verified in public Chromium:

- V2 worker owns only \`/diet/v2/\`
- V2 cache is installed
- offline reload serves V2
- v1 is never substituted as the offline shell

## Account/auth state

Automated certification proves:

- clean browser exposes sign-in,
- V2 initiates Google through canonical Supabase Auth,
- authorization destination is constrained to the expected Supabase origin/path,
- shared relay recognizes the V2 target,
- V2 receives the callback route,
- PKCE callback exchange code exists and is statically/contract tested,
- storage fallback is regression tested,
- local sign-out exists,
- invalid sessions remain fail-closed from P10.

Automated CI deliberately does **not** complete a real Google account consent flow because that would require a human account/session and interactive third-party authentication.

## Physical-device sign-off still required

The following items cannot honestly be certified by GitHub-hosted browsers or repository tooling.

They require a physical Android device.

### Android/PWA install

1. Open \`https://thiepn.dev/diet/v2/\` in Chrome.
2. Install Diet Copilot.
3. Confirm it launches standalone without a Chrome badge/browser chrome.
4. Close and relaunch it from the launcher.
5. Confirm the app reopens to V2, not production v1.
6. Update/reload once after an RC deployment and verify the installed app receives the new worker.

### Real Google account

1. Start from a clean signed-out V2 install.
2. Tap Account.
3. Tap **Continue with Google**.
4. Complete Google account selection/consent.
5. Confirm the callback returns to \`/diet/v2/\`.
6. Confirm private Diet data loads.
7. Kill and reopen the installed app.
8. Confirm the authenticated session persists.
9. Sign out.
10. Confirm private data disappears immediately.

### Offline/reconnect

1. Open V2 while signed in and online.
2. Allow a successful cloud refresh.
3. Enable airplane mode.
4. Relaunch V2.
5. Confirm the owner-matched offline snapshot loads.
6. Confirm food writes are not falsely presented as synced while offline.
7. Restore connectivity.
8. Refresh and verify canonical cloud state reconciles.

### Health Connect

On the Android native build that exposes the Diet Health Connect plugin:

1. Open Integrations.
2. Connect Health Connect.
3. Review requested permissions.
4. Allow access.
5. Run a manual sync.
6. Confirm steps/activity appear.
7. Confirm activity context does not automatically increase calories beyond the P6 training-distribution rules.
8. Revoke Health Connect permission in Android settings.
9. Return to Diet Copilot and confirm the integration reports the revoked/unavailable state cleanly.

### Real-device UI

Check at normal and large Android font/display scaling:

- Today
- Food
- Progress
- Strategy
- More
- food logger
- meal editor
- Copilot
- account dialog
- data/export
- appearance

Confirm:

- no clipped controls,
- no three-row persistent toolbar,
- buttons remain centered,
- bottom navigation stays one row,
- dialogs remain scrollable,
- keyboard does not hide the primary action,
- no page-level horizontal scrolling.

## P11 release status

### Certified automatically

- public HTTPS RC deployment
- exact deployed bytes
- V2-v1 route isolation
- clean signed-out V2 startup
- standalone sign-in entry
- canonical OAuth initiation
- V2 OAuth relay routing
- Chromium browser behavior
- Firefox browser behavior
- WebKit browser behavior
- 390 px mobile layout constraints
- appearance persistence
- V2 service-worker scope
- PWA offline reload
- no browser runtime exceptions
- unchanged backend security contracts

### Pending physical-device sign-off

- actual Google consent completion with a real account
- physical Android installed-PWA lifecycle
- real Android offline/reconnect lifecycle
- Health Connect permissions and real health/activity sync
- physical-device large-font/keyboard visual QA

## Promotion rule

Diet Copilot 2.0 should not replace the v1 root solely because P11 automated certification is green.

Production promotion should happen only after the short physical-device checklist above passes.

No additional product feature work is required to perform that checklist.
