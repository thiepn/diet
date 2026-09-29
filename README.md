# Diet Copilot

**Web 2.0.1 · P15 production resilience**

Diet Copilot 2.0 remains the production nutrition tracker at **https://thiepn.dev/diet/**. P15 is a backend/operations release: the browser remains Web 2.0.1 while production gains verified recovery snapshots, restore drills and encrypted off-site backups.

## P15 recovery architecture

The canonical THIEPN Account Supabase project is currently on the Free plan, so Diet does not rely on Supabase-managed daily backups or PITR.

P15 adds:

- private, owner-scoped snapshots of all 18 Diet-owned tables;
- SHA-256 payload integrity and a live schema fingerprint;
- exact row-count, owner and parse validation on every snapshot;
- daily snapshots retained 35 days;
- monthly snapshots retained 370 days;
- a non-destructive restore staging workflow;
- a restore-plan function that never performs a destructive restore automatically;
- encrypted off-site GitHub Actions backups retained 90 days;
- GitHub OIDC authentication to Supabase—no long-lived Supabase key stored in GitHub;
- AES-256-GCM CMS encryption to an RSA-3072 recovery certificate before artifact upload;
- explicit exclusion of native device credential digests.

Recovery snapshots reference `auth.users` with `ON DELETE CASCADE`. Explicit account deletion therefore deletes the in-database recovery snapshots too; P15 is not a hidden retention mechanism.

## Security and reliability layers

P14 authorization hardening remains in force:

- authenticated owner-scoped reads;
- direct browser table mutation denied;
- mutations only through `diet_app_*` RPCs;
- restrictive owner RLS, session-owner triggers and owner-coupled foreign keys.

P13 reliability protections also remain active:

- local-only sanitized operational telemetry;
- System Health diagnostics;
- foreground revalidation;
- uncertain-write blocking;
- hourly production monitoring.

## Off-site backup recovery key

Only the **public** recovery certificate is stored in this repository. The private key must remain offline and separate from both GitHub and Supabase. Without that key, encrypted P15 off-site artifacts cannot be decrypted.

## Production and rollback

- `/diet/` — canonical Diet Copilot 2.0.
- `/diet/v2/` — stable compatibility alias.
- `/diet/legacy-v1.html` — independently sign-in-capable V1 emergency fallback.
- Browser/PWA runtime stays Web 2.0.1 in P15.

## Verification

```bash
node tests/p13-telemetry.mjs
node tests/p14-security-contract.mjs
node tests/p15-resilience-contract.mjs
python -m py_compile scripts/p15-verify-offsite.py
```

See [P15 disaster recovery](docs/P15-DISASTER-RECOVERY.md), [P14 security hardening](docs/P14-SECURITY-HARDENING.md), and [QA.md](QA.md).
