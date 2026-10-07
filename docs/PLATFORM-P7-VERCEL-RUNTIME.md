# Platform P7 — First Product-Owned Server Workload Migration & Vercel Runtime Certification

This platform phase migrates the first genuinely server-owned product workload to Vercel without turning THIEPN Core into a central product backend.

## Selected workload

**Diet Copilot remote AI explanation** is the migration target.

The browser already keeps deterministic nutrition calculations on-device and only sends a compact derived context when a question cannot be answered locally. The existing remote implementation is therefore a narrow server workload:

- validate the signed-in user;
- bound and sanitize the request;
- call the configured AI provider;
- validate and sanitize the returned proposal;
- return an explanation and at most one allowlisted proposal.

The server does **not** own nutrition calculations or Diet database writes.

## Runtime ownership after cutover

| Concern | Authority |
| --- | --- |
| Diet frontend | GitHub Pages at `https://thiepn.dev/diet/` |
| Diet Copilot server compute | Vercel project `thiepn-diet` |
| Identity | Supabase Auth |
| Diet persistence / RLS / Realtime | Supabase |
| Shared contracts | THIEPN Core |
| Source, CI and release evidence | GitHub |

No `platform.thiepn.dev` backend is introduced.

## Security boundary

The Vercel function receives the user's existing Supabase access token and validates it against Supabase Auth before any provider call. It uses only the Supabase **publishable** key for that validation.

It intentionally has:

- no Supabase secret/service-role key;
- no direct Diet database access;
- no ability to apply a nutrition target or log food by itself;
- no ability to bypass the existing confirmed-write path in `v2/write-api.mjs`.

The deterministic context/action allowlists are preserved from the currently deployed Edge Function.

## Source

- `api/copilot.js` — product-owned Vercel workload.
- `api/health.js` — liveness/readiness surface without secret values.
- `v2/server-runtime.mjs` — explicit cutover gate.
- `platform-p7-runtime-certification.json` — machine-readable ownership and certification state.
- `tests/platform-p7-vercel-runtime-contract.mjs` — static boundary regression.

## Deployment model

P7 follows the P5 family standard:

- project name: `thiepn-diet`;
- function region: `dub1`;
- no Git integration;
- no automatic push/PR deployment;
- no production domain cutover;
- `thiepn.dev` stays on GitHub Pages;
- deployment is manual/prebuilt and evidence-driven.

Required Vercel runtime variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `OPENAI_API_KEY`
- optional `DIET_COPILOT_ALLOWED_ORIGINS`

The server calls the OpenAI Responses API directly and is pinned to GPT-6 Luna (`gpt-6-luna`). Vercel AI Gateway is not part of the production path. The required provider credential is `OPENAI_API_KEY`; `DIET_COPILOT_AI_API_KEY` remains accepted only as a compatibility alias while the migration is being completed.

The publishable Supabase key is not privileged. The OpenAI API key exists only as a Vercel runtime secret; no service-role key, database credential, provider key, or OIDC credential is committed.

## Cutover gate

The checked-in runtime gate is now `active: "vercel"`. Diet Copilot uses the product-owned Vercel runtime first, while the retained Supabase Edge Function remains rollback-only during post-cutover confidence.

P7 completes only after all of the following are true:

1. `thiepn-diet` is created in the intended Vercel team.
2. Required runtime variables are configured.
3. `/api/health` reports `ready: true` and `region: "dub1"`.
4. An unauthenticated Copilot request is rejected with 401.
5. The live provider, auth boundary, CORS, browser bearer-token contract, sanitizer, and rollback path are certified without weakening the production auth policy to manufacture a session.
6. `v2/server-runtime.mjs` flips the active runtime to `vercel`.
7. The old Supabase Edge Function is retained temporarily as rollback-only.
8. GitHub Pages production remains unchanged.

## Current certification state

Vercel project `thiepn-diet` now exists in the intended team and is configured for Node 24, `dub1`, a 30-second default function timeout, and preview-only Vercel Authentication. Provider inference is direct OpenAI GPT-6 Luna; Vercel AI Gateway is intentionally not used.

A tracked production candidate reached `READY`, and the GitHub live probe passed:

- health reports `ready: true`;
- runtime reports `vercel`;
- region reports `dub1`;
- unauthenticated Copilot requests return 401;
- allowed-origin preflight succeeds;
- disallowed-origin preflight is rejected.

P7 is **deployment-certified**. Production is Vercel-first, the provider is direct OpenAI GPT-6 Luna (`gpt-6-luna`), health is ready in `dub1`, the live auth boundary rejects unauthenticated calls, CORS is certified, and the browser contract passes the existing Supabase bearer token to the Vercel endpoint before sanitizing the returned proposal.

A human signed-in browser smoke was **not claimed as observed**. It is intentionally non-blocking for deployment certification because producing a synthetic session would require weakening or bypassing the real auth policy. The retained Supabase Edge Function remains rollback-only during post-cutover confidence.
