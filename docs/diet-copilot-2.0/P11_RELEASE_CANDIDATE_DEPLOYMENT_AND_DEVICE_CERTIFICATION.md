# P11 — Release Candidate Deployment & Real-Device Certification

Date: 2026-09-29  
Status: **Web RC certified; physical Android acceptance pending**

## Release candidate

- Production v1 remains at: `https://thiepn.dev/diet/`
- Diet Copilot 2.0 RC is deployed at: `https://thiepn.dev/diet/v2/`
- Current Diet `main`: `ae7cc5324f231b143ac84952716a236b96b8b140`
- Certified V2 runtime content was introduced by: `386434f52c77975c454178145e8ce53004912e70`
- Later main commits are certification/test infrastructure only and do not change the V2 runtime bundle.
- Frozen v1 archive remains exactly: `d25728bd478e50c545855fb07c63a445575fa465`

The RC is additive. The v1 root application remains the production entrypoint.

## Certification result

**PASS — public web release candidate**

P11 Live RC Certification run 7:
- Run ID: `36592574834`
- Head: `ae7cc5324f231b143ac84952716a236b96b8b140`
- Overall conclusion: **success**

All jobs passed:
- exact public RC byte verification
- Chromium live certification
- Firefox live certification
- WebKit live certification

Retained evidence artifacts:
- `p11-deployed-rc-assets`
- `p11-live-chromium`
- `p11-live-firefox`
- `p11-live-webkit`

## Live checks covered

The public HTTPS RC was checked for:

- Diet Copilot 2.0 title and RC marker
- five-route shell: Today, Food, Progress, Strategy, More
- clean-browser signed-out state
- V2 account dialog and Google sign-in entry
- canonical Supabase OAuth authorize destination
- shared OAuth relay returning V2 flows to `/diet/v2/`
- production root still serving v1
- compact one-row mobile bottom navigation
- one-row Food quick actions at 390 px viewport
- absence of page-level horizontal overflow
- dark-theme application and reload persistence
- no browser runtime errors
- Chromium V2 service-worker scope restricted to `/diet/v2/`
- P11 V2 cache installation
- offline reload continuing to serve V2 rather than falling through to v1

The existing account/browser release suite also passed on current main, including the v1 production asset checks.

## P11 defects found and fixed

### 1. V2 was not standalone for clean sessions

The first deployed RC could reuse an existing same-origin v1 session but had no V2-owned sign-in action.

Fixed by adding:
- V2 Google PKCE sign-in
- V2 callback exchange
- local V2 sign-out
- explicit account controls
- resilient PKCE verifier fallback when localStorage is unavailable

Long-lived auth sessions still use the existing persistent localStorage/cookie boundary rather than tab-only storage.

### 2. Shared OAuth relay needed a V2 target

The shared Wordstrike relay now understands the explicit `web-v2` target and can send Diet V2 callbacks to `/diet/v2/`.

OAuth callback navigations are excluded from the Wordstrike service-worker cache path.

### 3. Browser module parse failure

Live-browser certification found a literal `\\n` source artifact in `v2/data.js` around the Today training summary. It broke the V2 module graph in real browsers despite earlier static checks.

The source was corrected and a P11 regression guard was added.

### 4. Relay path case mismatch

Diet V2 initially used the legacy uppercase path `/WORDSTRIKE/`, which served the old Diet callback route.

V2 now uses the canonical relay:
`https://thiepn.dev/wordstrike/`

### 5. Certification workflow deadlock

The first live verifier could wait for Pages while occupying the runner needed by Pages.

The P11 certification workflow was restructured so test-only certification can run independently and exact public byte verification remains a required gate.

### 6. Firefox test-harness incompatibility

Playwright Firefox does not support `is_mobile=True` when creating a browser context.

The responsive test now certifies the actual CSS breakpoint using a 390 × 844 viewport without an unsupported browser-emulation option. Chromium, Firefox and WebKit all pass the corrected matrix.

## Production safety

P11 did **not**:
- replace the v1 root application with V2
- alter production nutrition rows
- alter Supabase schema
- alter RLS policies
- alter canonical nutrition calculations through AI
- revive the retired Diet Supabase project

The only root runtime change introduced for the RC deployment was the previously certified service-worker isolation required to prevent the v1 worker from intercepting `/v2/`.

## Physical-device acceptance boundary

The automated certification uses real Chromium, Firefox and WebKit browser engines against the public HTTPS deployment, including a real service-worker install and Chromium offline reload.

It cannot claim completion of checks requiring the user's physical Android hardware, Google account interaction, Android companion or Health Connect UI.

The following acceptance checks therefore remain **manual physical-device checks**, not known code failures:

1. Open `https://thiepn.dev/diet/v2/` in Chrome on the target Android phone.
2. Complete a real Google account selection/consent flow and confirm return to `/diet/v2/`.
3. Close/reopen the browser or installed PWA and confirm the session restores.
4. Install the V2 PWA and confirm standalone launch, icon, scope and update behavior.
5. Test online → offline → reload → online recovery on the physical phone.
6. Exercise representative writes: add food, edit meal, delete/correct an entry, and verify live refresh.
7. If the Android companion is part of this RC, test its native auth callback on the installed APK.
8. If Health Connect is part of the installed companion build, test permission grant/deny/revoke and actual sync on-device.
9. Sign out and confirm private UI/cache state is cleared as expected.
10. Re-test at the device's normal font/display scaling and one-handed mobile usage.

## Release decision

**Web RC: certified.**

The RC can remain available at `/diet/v2/` for real personal usage and physical-device acceptance while v1 stays the production root.

Do not promote V2 to the root production route solely from this automated certification. Promotion should follow successful physical-device acceptance of the Android/PWA/auth flows that are actually intended for the release.
