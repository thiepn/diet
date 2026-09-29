# P22 Supply-Chain Policy

## Runtime

The browser must load application code from the same Diet deployment. Remote `<script src="https://...">` dependencies and remote ESM imports are rejected by the P22 verifier.

Supabase JS is vendored locally and protected by the SHA-256 recorded in `supply-chain.lock.json`.

## GitHub Actions

All external Actions must:

1. be in the P22 allowlist;
2. use a full immutable 40-character commit SHA;
3. match the reviewed SHA in `supply-chain.lock.json`.

Floating tags such as `actions/checkout@v6` are prohibited.

A version comment may remain beside the SHA for readability, for example:

`actions/checkout@<immutable-sha> # v6`

## Updates

Dependabot may propose GitHub Action updates, but P22 intentionally requires human review of the corresponding lock change.

Vendored runtime updates require:

- source/version review;
- new SHA-256;
- static P22 supply-chain verification;
- P13–P22 regressions;
- production/browser certification as appropriate.

## CI-only tools

Playwright is version-pinned. It is used only in ephemeral CI and is not shipped to production.

## Prohibited patterns

P22 rejects:

- floating external Action refs;
- unreviewed external Action repositories;
- workflow `curl | sh` / `wget | sh` installation;
- remote browser script dependencies;
- remote browser ESM imports;
- silent replacement of the vendored Supabase client.
