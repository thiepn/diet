# Diet Copilot — V0.5 Release Candidate

Diet Copilot is a mobile-first, local-first calorie, protein, and body-weight tracker designed around a simple architecture:

```text
ChatGPT = interpretation and conversation
Supabase = durable shared data
GitHub Pages app = dashboard + manual fallback
```

V0.5 deliberately stops feature expansion and hardens the core product for V1.0.

## Current capabilities

- Today calorie/protein dashboard
- date-aware targets
- Open / Complete / Partial day status
- body-weight logging + trend
- item-level meals with calorie uncertainty ranges
- saved foods and reusable meals
- Yesterday / Recent / Usual quick logging
- History search + progressive loading
- JSON backup/import
- local-first offline operation
- optional Supabase auth + multi-device sync
- optimistic conflict detection for offline edits
- AI action audit + undo
- ChatGPT RPC contract for read/search/create/update/delete/weight/undo
- PWA shell for GitHub Pages
- in-app V0.5 release check

## Run locally

There is no build step.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

The frontend runtime is split into ordered `app-01.js` … `app-21.js` files and four CSS files so the repository can be maintained through connector-based GitHub writes. They are loaded in order by `index.html`; this does not change app behavior.

## GitHub Pages

The repository root is deployable directly.

In GitHub:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select `main` and `/ (root)`.
4. Save.

The expected site URL is:

```text
https://thiepn.github.io/diet/
```

## Supabase

Cloud mode is optional. Local tracking works without it.

### Fresh project or full schema refresh

The canonical V0.5 schema is stored losslessly as:

```text
supabase/schema.sql.gz
```

Decompress it first:

```bash
gzip -dc supabase/schema.sql.gz > supabase/schema.sql
```

Then run the resulting `schema.sql` in the Supabase SQL Editor.

The full schema is designed to be safe for a fresh project and for upgrading the older Diet Copilot V0.2–V0.4 schema.

### Upgrade specifically from V0.4

You may instead run:

```text
supabase/upgrade-v0.4-to-v0.5.sql
```

After setup/upgrade:

1. Open Diet Copilot.
2. Configure **Settings → Supabase cloud** using the project URL and a publishable client key.
3. Sign in.
4. Run **Settings → V0.5 release check**.
5. Confirm it reports **Schema v5**.
6. Choose an explicit first-sync direction.

### Security

The static frontend must use only a **publishable/anon client key**. Never put a Supabase secret/service-role key in GitHub Pages.

The schema uses both explicit Data API grants and owner-only Row Level Security. Child rows also enforce parent ownership consistency.

## ChatGPT integration boundary

Publishing this site does not by itself allow a normal ChatGPT conversation to edit the page. The intended integration is:

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

The browser app does not contain an OpenAI API key.

## Reliability changes in V0.5

### Offline-safe conflict detection

Queued writes remember the cloud row version last seen by the device. Before updating or deleting a previously synced record, V0.5 checks that the cloud row has not changed. If it has, sync stops and shows an explicit conflict instead of silently overwriting newer data.

### Safer queue lifecycle

V0.5 handles cases such as:

- create offline → delete before first sync
- deleting an unsynced meal with queued child items
- parent/child upload ordering
- retry backoff for network failures
- account/project isolation on sign-out or project changes

### AI mutation safety

The Supabase layer supports:

- idempotent requests
- stale-write protection
- before/after AI audit records
- undo for supported AI mutations
- uncertainty ranges for estimated meals

## Validation

Run:

```bash
python tools/validate_release.py
```

Manual release scenarios are documented in `QA.md`.

V1.0 should not be tagged until real-device testing covers Android, desktop, multi-device sync, offline reconnect/conflicts, migrations, and end-to-end ChatGPT RPC behavior.

## Repository structure

```text
index.html
app-01.js … app-21.js
styles-01.css … styles-04.css
sw.js
manifest.webmanifest
icon.svg / icon-192.png / icon-512.png
QA.md
tools/
supabase/
```
