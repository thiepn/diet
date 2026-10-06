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
- `DIET_COPILOT_AI_API_KEY` (or `OPENAI_API_KEY`)
- optional `DIET_COPILOT_AI_ENDPOINT`
- optional `DIET_COPILOT_AI_MODEL`
- optional `DIET_COPILOT_ALLOWED_ORIGINS`

The publishable Supabase key is not privileged, but it is still configured as environment data so the runtime remains portable. Provider credentials are never committed.

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

## Current blocker

The connected Vercel account can read the existing `thiepn-hub` project, but project creation returned HTTP 403 because the connector is not currently authorized for scope `thiepn-project`.

The source migration can therefore be prepared and reviewed now, but the runtime must not be marked certified or activated until that Vercel scope is re-authorized.
