# Diet Copilot 2.0.2 — P16 production performance gates

Date: 2026-09-29.

| Gate | Coverage |
| --- | --- |
| CI | P13, P14, P15 regressions plus P16 static performance contract |
| A7 | combined operations/security/resilience/performance invariants |
| A8 | Google-only Account consumer contract |
| A9 | Account Platform v1 consumer release 2.0.2 |
| P16 static | one-request transport, fallback owner filters, Realtime ownership, cache versions, asset budget |
| P16 public probe | publishable/anonymous client cannot execute the consolidated private read RPC |
| Live DB | authenticated snapshot shape, invoker security, anonymous-account rejection |
| Advisors | no P16 security defect; speculative unused indexes removed after advisor review |

## P16 invariants

- Normal signed-in data refresh uses one RPC.
- P14 RLS remains authoritative.
- Compatibility fallback filters every owner table with `user_id`.
- Realtime INSERT/UPDATE traffic is owner-filtered.
- Broad DELETE Postgres Changes subscription is disabled.
- Nutrition engine and read-model semantics are unchanged.
- P15 backup/recovery behavior is unchanged.
- Installed PWAs move to the P16 cache namespace.
- Raw core static footprint must remain at or below 700,000 bytes.
- P16 must not retain speculative indexes that the production advisor reports unused.
