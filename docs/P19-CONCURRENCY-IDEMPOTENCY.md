# P19 — Concurrency, Idempotency & Multi-Device Mutation Hardening

Date: 2026-09-29. Browser release remains Web 2.0.3. Operations release: P19.0.

P19 hardens every authenticated Diet write against duplicate delivery, request-ID collisions and simultaneous multi-device mutation. It changes the database execution boundary, not the browser UI or nutrition algorithms.

## What P19 fixes

Before P19, Diet already retried writes with the same request ID and most mutation functions recorded an `ai_actions` entry. That prevented many duplicates, but replay semantics were coupled to individual RPC implementations. In particular, a reused request ID was not universally bound to both the operation and its payload.

P19 introduces a single transactional idempotency contract in front of all 18 authenticated `diet_app_*` mutation RPCs.

## Transactional request ledger

`private.diet_mutation_requests` is keyed by:

`(user_id, request_id)`

Each request is additionally bound to:

- the exact public operation name;
- SHA-256 of PostgreSQL's canonical `jsonb` payload representation.

The full request payload is **not** stored in the ledger.

A request can be `started` or `complete`. Completed requests retain the committed JSON result so a retry after a lost HTTP response can return the original result without executing the mutation again.

## Exact replay rules

For the same owner:

- **same request ID + same operation + same payload:** return the stored committed result and mark it as P19 replay;
- **same request ID + different payload:** reject;
- **same request ID + different operation:** reject;
- **failed transaction:** the request claim rolls back with the mutation, so a later retry can execute normally.

This removes ambiguity between network retries and genuinely different mutations.

## Owner-level serialization

`private.diet_p19_begin_mutation()` acquires a transaction-scoped PostgreSQL advisory lock derived from the owner UUID before executing the private mutation core.

Therefore two different writes for the same owner cannot mutate Diet data concurrently even when they come from different devices, tabs or network retries.

The lock is transaction scoped and automatically releases at commit or rollback. A theoretical hash collision can only cause harmless extra serialization between unrelated owners; it cannot grant data access.

## Public wrappers and private cores

P19 preserves all existing public RPC names and argument signatures.

The previous 18 public mutation implementations are moved into the `private` schema. New public wrappers:

1. verify authenticated, non-anonymous Diet identity;
2. claim the request ID and payload;
3. return an exact stored replay when already complete;
4. invoke the existing private mutation core;
5. store the committed result in the request ledger;
6. return the same result shape to the caller.

Authenticated clients have EXECUTE on the wrappers and **no direct EXECUTE** on the private cores or request helpers.

This means existing Web 2.0.3 client code does not need a new transport or another HTTP round trip.

## Optimistic content conflicts

P19 does not replace the existing `expected_updated_at` guards.

Content-bearing edit/delete operations continue to reject stale data after the per-owner mutation lock is acquired. The release probe confirmed a deliberately stale saved-food delete still fails with a conflict.

P19 explicitly does **not** auto-merge stale content.

## Explicit state setters

Favorite/unfavorite operations are explicit boolean state setters rather than free-form content edits. They remain last-write-wins, but P19 serializes them per owner so the ordering is deterministic.

This distinction is intentional and documented in the concurrency policy.

## Retention and privacy

The request ledger is ephemeral operational state:

- private schema;
- RLS enabled;
- restrictive authenticated deny policy;
- no browser table access;
- account deletion cascades through `auth.users`;
- 35-day retention;
- pruned daily at **03:27 UTC**;
- not included in the P17 owner export;
- not required in P15 disaster-recovery backups.

Only SHA-256 of the canonical request payload is stored. The replay result is retained for the same 35-day window.

## Operational status

`public.diet_p19_concurrency_status()` reports structural P19 status for service operations only.

Production certification state:

- 18 public write wrappers;
- 18 private write cores;
- 0 stuck `started` requests;
- 35-day retention;
- owner serialization enabled;
- payload-bound idempotency enabled;
- stale-content auto-merge disabled.

The status RPC is unavailable to `anon` and `authenticated`.

## Verification

P19 certification covers:

1. exact same-request replay;
2. same-ID/different-payload rejection;
3. same-ID/different-operation rejection;
4. stale `expected_updated_at` conflict preservation;
5. 18 wrapper / 18 private-core parity;
6. zero authenticated direct private-core access;
7. zero anonymous wrapper execution grants;
8. private ledger access denial;
9. one 03:27 UTC prune job;
10. service-only operational status;
11. zero P19-specific Supabase security advisor findings;
12. zero P19-specific Supabase performance advisor findings;
13. full P14–P18 regression suite.

P19 does not change adaptive nutrition decisions, owner RLS, backup encryption, lifecycle deletion, integrity checks, or Web/PWA cache versions.
