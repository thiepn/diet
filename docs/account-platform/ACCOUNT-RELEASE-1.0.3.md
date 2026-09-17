# Account release audit — Web 1.0.3

Scope: finalize the existing read-only Google-authenticated Diet Copilot web application. Baseline: cf8652878165b1d85d860d6579d56a803fa1aae1. Repair: PR #11, fix/account-release-final. Audit date: 2026-09-17.

## Confirmed findings and repairs

| Finding | Repair / regression evidence |
| --- | --- |
| An unguarded top-level History preference read threw when localStorage was blocked and stopped the production bundle before account startup | Guard and validate preference reads/writes; execute whole-bundle blocked-storage and preference-interaction tests |
| Runtime depended on late static10/10b/10c storage patches and repeated bootstrap attempts | Remove the compatibility file and load one adapter/controller before the sole bootstrap |
| A tab-only fallback could be mistaken for persistent sign-in | Verified persistent adapter; sessionStorage restricted to temporary OAuth recovery; explicit unsupported-storage state |
| Cookie and localStorage copies could disagree after token rotation | Sticky cookie authority after fallback, immutable chunks and verified manifest publication; stale-copy tests |
| Cached nutrition was not associated with an authenticated owner | Owner-tagged cache capsule loaded only after identity resolution; cross-owner cache rejected |
| In-flight or queued reads could complete after logout/account switching | Abort requests and check owner/client/epoch before state mutation; clear private DOM at identity boundaries |
| Duplicate initialization, refresh and realtime work could compete | Single-flight lifecycle and owner-scoped request/subscription coordination |
| Logout, temporary outages and revoked sessions were conflated | Distinct signed-out, connection-error and invalid-session paths; local cleanup even when server revocation fails |
| Native retries and delayed callbacks needed lifecycle bounds | Single listener/attempt handling, flow TTL/matching, account epoch guards |
| Clipboard diagnostics used event.currentTarget after await | Capture the button synchronously and provide a visible copy fallback |
| Service-worker installation referenced metadata omitted by Pages; auth depended on a CDN | Include .well-known in generated output; vendor the exact existing SDK; test real worker installation/offline restoration |
| Historical CI checked source strings but not tab/browser persistence | Add 13 storage cases, 35 real-browser cases per engine, six real-worker checks and post-deployment byte verification |

## Architecture and security boundary

The shared Supabase project/key and Google-only account contract remain unchanged. There is one client/session authority, not an app-specific backup-token restoration mechanism. No production user or nutrition data was used as a test fixture. Database inspection was read-only; all 13 inspected dashboard tables had RLS and owner-scoped authenticated SELECT access.

Fallback cookies are first-party client storage: Secure on HTTPS and SameSite=Lax, but not HttpOnly. No claim of server-session isolation or end-to-end encryption is made. Persisting a client login assumes the browser retains site data and the backend has not revoked the session.

Diagnostics omit raw access/refresh/provider tokens, OAuth codes, email addresses and nutrition payloads. Cached private content is hidden or removed at identity transitions. Network failures do not justify erasing a valid session.

## Verification and release decision

The browser fixture uses the actual Pages output and pinned Supabase SDK in Chromium, Firefox and WebKit. The provider leg is a mocked cross-origin browser navigation, and backend responses use synthetic users. Disk-backed process restart tests do not copy browser storage snapshots. Real service-worker tests separately exercise offline navigation and cache policy.

Two defects in the test harness were also corrected rather than attributed to the app: an about:blank quota-injection read and Playwright evaluation of a returned clipboard function. WebKit's interception API does not support fulfilling an HTTP 302, so the mocked provider navigates through a small HTML fixture; the real app's PKCE exchange is still exercised.

Current result artifacts and workflow conclusions are authoritative. Release requires all CI/A7/A8/A9/browser/worker gates, then Pages deployment and eight-asset byte equality. No physical Android/Health Connect or live Google-user consent certification is implied. Existing Android integration is preserved; this is a web release, not a new signed mobile-store build.

Operational follow-up is maintenance of this frozen scope, not another open-ended feature roadmap. A personal-profile issue should be investigated through Account → Connection details, not by stacking new hotfix scripts or repeatedly clearing all site storage.
