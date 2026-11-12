# Security guidance for this repo
- Every route handler must validate input with the shared zod schema before use (ASVS V2).
- Every data access must be scoped by the authenticated principal's tenant/user id (ASVS V8; OWASP A01).
- Never log request bodies, tokens, or env values; use the structured logger's redact list (OWASP A09, CWE-117).
- Errors must be handled explicitly; no empty catch blocks (OWASP A10).
