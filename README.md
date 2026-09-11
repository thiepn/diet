# Diet Copilot — V1.0

Diet Copilot is a mobile-first calorie, protein, and body-weight tracker built around a simple architecture:

```text
ChatGPT = interpretation and conversation
Supabase = durable shared data
GitHub Pages app = dashboard + manual fallback
```

V1.0 is the first stable local-first client release. The focus is trustworthy daily use rather than additional feature breadth.

## Core features

- calorie + protein targets with historical per-day snapshots
- item-level meals with confidence/source metadata and uncertainty ranges
- saved foods and reusable meals
- one-tap Usuals / Yesterday / Recent logging
- body-weight tracking and seven-entry trend analysis
- Open / Complete / Partial day status
- history search and progressive loading
- local-first/offline operation
- JSON backup/import and recovery snapshots
- optional Supabase authentication and multi-device sync
- offline queueing + optimistic conflict detection
- AI mutation audit + undo
- ChatGPT-ready Supabase RPC contract
- installable PWA shell

## V1.0 stabilization

V1.0 keeps the V0.5 database schema (`schema_version = 5`) and hardens the client around it:

- version-independent browser storage keys
- automatic V0.1–V0.5 local-state migration
- first-run target confirmation instead of treating defaults as personal targets
- safety snapshots before destructive local replacements/import/reset
- recovery and diagnostic controls moved under **Settings → Advanced**
- explicit Supabase auth-listener/client cleanup when reconfigured
- blank/zero-item meals and saved meals cannot be saved
- saved-meal quick logging preserves the least-certain item confidence
- weight-trend comparison uses complete seven-entry rolling windows
- clearer cloud errors/conflicts and improved accessibility

## Run locally

There is no build step.

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

Opening `index.html` directly supports local tracking, but service-worker/PWA behavior requires HTTP(S).

## GitHub Pages

Deploy the repository root directly:

1. Open **Settings → Pages**.
2. Choose **Deploy from a branch**.
3. Select `main` and `/ (root)`.
4. Save.

Expected URL:

```text
https://thiepn.github.io/diet/
```

## Supabase

Cloud mode is optional. Local tracking works without Supabase.

### Fresh project

The canonical V0.5/V1.0 database schema is stored as `supabase/schema.sql.gz` in this repository. Decompress it and run the SQL in Supabase:

```bash
gzip -dc supabase/schema.sql.gz > supabase/schema.sql
```

### Existing V0.5 database

No V1.0 database migration is required. V1.0 intentionally retains database schema version 5.

### V0.4 database

Run:

```text
supabase/upgrade-v0.4-to-v0.5.sql
```

After setup, configure **Settings → Cloud sync** with the project URL and a browser-safe publishable/anon key, sign in, then run **Settings → Advanced → Health check**.

Never put a Supabase secret/service-role key in this static frontend.

## ChatGPT integration boundary

Publishing the GitHub Pages app does not itself give a normal ChatGPT conversation permission to edit it. The intended architecture is:

```text
ChatGPT / authenticated connector
              │
              ▼
       Supabase RPC + RLS
              │
       shared diet records
              │
              ▼
       GitHub Pages app
```

See:

- `supabase/chatgpt-bridge.md`
- `supabase/photo-estimate-contract.md`

The browser app contains no OpenAI API key.

## Validation

Run:

```bash
python tools/validate_release.py
```

The V1.0 development pass also includes browser-DOM regression coverage for fresh first run, target confirmation, meal validation, V0.5 storage migration, saved-meal uncertainty, weight trends, safety backup/reset, and local integrity checks.

Real Supabase multi-device and physical-device scenarios are listed in `QA.md` and must be completed against a dedicated Diet Copilot project before cloud sync is treated as production-critical.

## Repository layout

```text
index.html
app-v1-01.js … app-v1-12.js
styles-v1-01.css
styles-v1-02.css
sw.js
manifest.webmanifest
icon.svg / icon-192.png / icon-512.png
README.md
CHANGELOG.md
QA.md
supabase/
tools/
```
