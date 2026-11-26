# Lifecycle test note

**Test design:** A temporary SQLite database and a key with a daily limit of one request are used.

| Step | Expected result | Verification |
|---|---|---|
| Create key | HTTP 201; token shown once | PASS |
| Inspect database | SHA-256 hash stored, raw token absent | PASS |
| First API request | HTTP 200 with package JSON | PASS |
| Second API request on same day | HTTP 429 with UTC-midnight retry hint | PASS |
| Usage count after two calls | Exactly 2 rows for the key | PASS |
| Revoke key | HTTP 200 | PASS |
| Call using revoked token | HTTP 401 | PASS |
| Call without a key | HTTP 401 JSON | PASS |

Run `npm run test:lifecycle` to execute these checks locally. These are expected test outcomes; attach the terminal output from your own run when submitting.
