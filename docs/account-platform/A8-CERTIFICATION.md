# A8 — Developer Platform Consumer Certification

**Consumer:** Diet Copilot  
**Account contract:** 1.0  
**SDK compatibility:** 1.x  
**Integration mode:** `certified-legacy`  
**Verdict:** **CONSUMER CONTRACT CERTIFIED**

A8 leaves the A6/A7 Diet authentication implementation and V6.5 product behavior untouched. The consumer publishes the normalized A8 manifest and is guarded by a dedicated compatibility workflow against the frozen developer contract.

## Contract

- THIEPN Account remains the sole identity/session authority;
- Google and email/password remain the declared Diet account entry points;
- browser sign-out is explicitly local;
- duplicate app-specific token restoration remains prohibited;
- the dashboard remains read-only and never falls back to the retired Diet backend;
- canonical backend writes continue to require stable request IDs;
- backend/network failure preserves the last trustworthy cached dashboard state and does not become logout.

## Certification evidence

- A8 consumer-contract workflow passes.
- Existing Diet CI/backend/PWA contract passes.
- A7 operations contract passes.
- No Diet product/auth runtime code is changed by A8.

Merge remains gated on those workflows being green for the final A8 head. Runtime behavior remains the A7-certified release.
