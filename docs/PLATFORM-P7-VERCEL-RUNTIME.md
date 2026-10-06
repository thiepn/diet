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

The checked-in runtime gate remains `active: "supabase-edge"` until Vercel is provisioned and certified. This avoids adding latency or breaking current AI behavior while the target project is unavailable.

P7 completes only after all of the following are true:

1. `thiepn-diet` is created in the intended Vercel team.
2. Required runtime variables are configured.
3. `/api/health` reports `ready: true` and `region: "dub1"`.
4. An unauthenticated Copilot request is rejected with 401.
5. A real signed-in request returns a sanitized remote reply.
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

The browser runtime is now in a controlled Vercel-first canary: signed-in remote Copilot questions try `thiepn-diet` first and automatically fall back to the retained Supabase Edge Function on any Vercel/auth/provider failure. `OPENAI_API_KEY` is configured in Vercel production/preview, the direct OpenAI GPT-6 Luna provider probe returned HTTP 200 with output, and the production deployment at commit `33de2065e3dc11e99e2bc3d498dbf541e44b12a1` reports `ready: true` in `dub1`. The only remaining certification gate is observing one signed-in GPT-6 Luna response from the production Vercel runtime that returns a sanitized remote reply.
