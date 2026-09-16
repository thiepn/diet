# A8 — Developer Platform Consumer Certification

**Consumer:** Diet Copilot  
**Account contract:** 1.0  
**SDK compatibility:** 1.x  
**Integration mode:** `certified-legacy`  
**Consumer release:** `1.0.1`  
**Verdict:** **CONSUMER CONTRACT CERTIFIED**

## Contract

- THIEPN Account remains the sole identity/session authority.
- Diet Copilot exposes Google sign-in only.
- Browser and Android OAuth use PKCE.
- Browser sign-out is explicitly local.
- Duplicate app-specific token restoration remains prohibited.
- Diet data stays owner-scoped and read-only in the dashboard.
- The retired Diet backend never returns to runtime configuration.
- Network/backend failure preserves the last trustworthy cached dashboard state rather than becoming logout.

## Certification evidence

- A8 consumer-contract workflow rejects any active password-auth implementation.
- Existing Diet CI/backend/PWA contracts pass.
- A7 operations contract passes.
- Native PKCE handoff is represented in canonical source and release tests.
