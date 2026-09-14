# A8 — Developer Platform Consumer Certification

**Consumer:** Diet Copilot  
**Account contract:** 1.0  
**SDK compatibility:** 1.x  
**Integration mode:** `certified-legacy`

A8 leaves the A6/A7 Diet authentication implementation and V6.5 product behavior untouched. The consumer now publishes the normalized A8 manifest and gains a dedicated compatibility check against the frozen developer contract.

## Contract

- THIEPN Account remains the sole identity/session authority;
- Google and email/password remain the declared Diet account entry points;
- browser sign-out is explicitly local;
- duplicate app-specific token restoration remains prohibited;
- the dashboard remains read-only and never falls back to the retired Diet backend;
- canonical backend writes continue to require stable request IDs;
- backend/network failure preserves the last trustworthy cached dashboard state and does not become logout.

## Status

**CERTIFICATION PENDING A8 CI.** Runtime behavior is unchanged from the A7-certified release.
