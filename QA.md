# Diet Copilot Web 1.0.3 — release gates

Date: 2026-09-17. Internal milestone: V6.8.2. Repair PR: #11.

This document defines the release gates. Their result is the corresponding commit's GitHub Actions run and attached JSON reports; a checked box or a version string is not evidence of a passing runtime.

## Required automated verification

| Gate | Coverage |
| --- | --- |
| CI | JavaScript syntax, fixed backend/product boundary, Google-only PKCE, deterministic bundles, nutrition/coaching fixtures, actual Jekyll output, size budgets |
| Account storage | 13 unit cases for storage writes, fallback, migration, corruption and cleanup |
| Chromium / Firefox / WebKit | 35 scenarios per engine, including tab closure and full disk-backed browser restart for localStorage and cookie-backed sessions |
| Real service worker | Six checks: complete precache, unrelated-cache preservation, offline reload, offline new tab, callback exclusion and no runtime exceptions |
| A7 / A8 / A9 | Operations, account consumer and platform release contracts |
| Pages deployment | Successful deployment of the merged release |
| Production assets | Eight public assets match the merged commit byte-for-byte, including the SDK, service worker and release manifests |

## Account regression scope

Clean startup; mocked provider navigation and explicit PKCE callback exchange; cookie-only OAuth; reload; close/reopen; full browser restart; blocked storage; storage quota; corrupted session; expired-token refresh; revoked token; backend failure; offline cached view; duplicate initialization; two-user switching; wrong-owner cached snapshot rejection; local sign-out; failed server revocation; pending-read sign-out; cross-tab sign-out through both persistent backends; cancelled OAuth; missing verifier; redacted diagnostics; clipboard fallback; desktop/mobile views; selected navigation; unrelated storage preservation; foreground resume; blocked preference storage; immediately queued refresh versus sign-out; pending realtime work during switching; native callback lifetime/matching and native entry retry.

The account suite executes the real bundled application and real Supabase SDK. Identity-provider responses and backend data are fixtures. Only the separate service-worker test allows worker interception. Browser screenshots are captured with animation disabled for stable visual inspection.

## Observed backend boundary

A read-only production policy inspection during this audit found RLS enabled and authenticated owner-scoped SELECT policies on the 13 inspected dashboard tables. No database migrations, policy changes, account changes, nutrition corrections or production logging operations were performed by this release audit. Historical data-integrity certifications are not repeated here as current results.

## Manual verification boundaries

The tests do not impersonate the user's Google account and do not reproduce every extension or site-data policy in a personal browser profile. Actual Google consent/account selection, physical Samsung Internet, installed Android companion, Health Connect and store packaging remain device/provider acceptance checks, not known code failures certified by a desktop engine test.

Normal browser persistence cannot survive deliberate site-data deletion, private-profile destruction, explicit sign-out or server-side revocation. Account diagnostics expose the surviving backend and lifecycle state without exporting secrets.

## Release and rollback

Merge only when all PR gates pass. After merging, require Pages success and public-asset verification. Tag the verified web commit. Preserve the existing backend and data; rollback is a reviewed frontend commit/release change, never a production database reset. Do not revive static10 compatibility scripts or temporary self-editing repair workflows.
