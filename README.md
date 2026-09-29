# Diet Copilot

**Web 2.0.3 · P17 privacy and data-lifecycle hardening**

Diet Copilot 2.0 remains live at **https://thiepn.dev/diet/**. P17 hardens owner data export, local-device privacy, and Account Platform lifecycle consistency without changing nutrition calculations.

## P17

The previous browser-generated JSON backup only represented data already loaded into the UI. P17 replaces it with an authoritative authenticated cloud export through `diet_app_export_owner_data()`.

The complete JSON export now covers all **18 Diet-owned tables** at request time. Authentication/OAuth secrets, native device credential digests, private recovery snapshots, local diagnostics, UI preferences and Copilot session history are excluded.

P17 also adds **Clear this device**, which signs Diet out locally and clears the offline Diet cache, local diagnostics, Copilot session, appearance preferences, PKCE/OAuth remnants and uncertain-write state. It never deletes cloud nutrition data.

Account deletion remains centrally owned by the THIEPN Account Platform. Production verification confirms all 18 live Diet tables and P15 in-database recovery snapshots use `ON DELETE CASCADE` from `auth.users`.

Encrypted P15 off-site disaster-recovery artifacts may retain historical data for up to **90 days**. They are not an active account data source and must never be used to reactivate a deliberately deleted account.

## Existing protection

- **P13:** local-only operational telemetry and degraded-mode reliability.
- **P14:** owner RLS, owner triggers, owner-coupled FKs and RPC authorization.
- **P15:** verified recovery snapshots and encrypted off-site backups.
- **P16:** consolidated owner reads, explicit owner filtering and performance budgets.

## Release

- Web/PWA: **2.0.3**
- Operations: **P17.0**
- Security: **P14**
- Resilience: **P15**
- Performance: **P16**
- Privacy/lifecycle: **P17**

See [P17 privacy & lifecycle hardening](docs/P17-PRIVACY-LIFECYCLE.md) and [QA.md](QA.md).
