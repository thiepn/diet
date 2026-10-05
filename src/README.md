# Legacy V1 rollback source

This directory is **not** the active Diet Copilot production runtime.

The active product is:

- `index.html`
- `v2/`

Files under `src/` are retained only because they are the source inputs for the certified V1 rollback bundle used by `legacy-v1.html`.

Rules:

1. Do not add new Diet Copilot product features here.
2. Do not load any `src/` file from production `index.html`.
3. Do not use this tree to decide current product behavior.
4. Changes here are allowed only to repair the rollback path or preserve compatibility.
5. Product development belongs in `v2/`.

The rollback builder is `scripts/build-v68.mjs`; despite its historical name, it now serves the legacy rollback bundle only.
