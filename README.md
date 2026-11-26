# Goan Trails — API Key Authentication

A Node.js 24 + Express + built-in SQLite project for a Goan tour operator's package API. It includes an admin control room, one-time API key display, SHA-256 token hashing, instant revocation, per-key usage logging and a daily request limit.

## Requirements

- Node.js 24 or newer (uses the built-in `node:sqlite` module; no native SQLite npm package is required)
- npm

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and set a strong `ADMIN_PASSWORD` and a long random `SESSION_SECRET`. On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000), then sign in using the admin password from `.env`.

## Key lifecycle

1. Sign in to the administrator dashboard.
2. Enter a descriptive key name and daily request limit, then choose **Generate key**.
3. Copy the token immediately. It is shown only once; the database stores its SHA-256 hash, never the raw token.
4. Use the token in the `X-API-Key` header.
5. The dashboard displays all-time usage and today's usage for every key.
6. Choose **Revoke key** to deactivate it. The next API request is rejected with HTTP 401.

## API reference

### Get tour packages

`GET /api/v1/packages`

Header: `X-API-Key: YOUR_API_KEY`

Success (200):

```bash
curl http://localhost:3000/api/v1/packages \
  -H "X-API-Key: YOUR_API_KEY"
```

Returns JSON containing four sample Goa packages, a request ID and the remaining daily allowance.

Missing key (401):

```bash
curl http://localhost:3000/api/v1/packages
```

Invalid or revoked key (401):

```bash
curl http://localhost:3000/api/v1/packages \
  -H "X-API-Key: invalid-or-revoked"
```

Daily limit exceeded (429):

```bash
curl http://localhost:3000/api/v1/packages \
  -H "X-API-Key: YOUR_LIMITED_KEY"
```

The 429 response includes `retry_after: "UTC midnight"`, a retry hint, the limit and usage count. Daily windows reset at 00:00 UTC.

### Admin endpoints

The admin routes are protected by a session created after `POST /admin/login`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/admin/login` | Sign in with `{ "password": "..." }` |
| GET | `/admin/session` | Check current session |
| GET | `/admin/keys` | List keys and usage counts |
| POST | `/admin/keys` | Create key with `{ "name": "...", "daily_limit": 100 }` |
| POST | `/admin/keys/:id/revoke` | Revoke a key immediately |
| POST | `/admin/logout` | End admin session |

## Database design

### `api_keys`

- `id`: primary key
- `name`: human-readable integration name
- `token_hash`: unique SHA-256 hash of the random token
- `active`: 1 for active, 0 for revoked
- `daily_limit`: maximum successful calls per UTC day
- `created_at`, `revoked_at`: lifecycle timestamps

### `api_usage`

- `id`: primary key
- `api_key_id`: foreign key to `api_keys`
- `endpoint`, `method`, `status_code`, `request_id`, `created_at`

Every request authenticated with a known active key is logged exactly once. A request that exceeds the daily allowance is also logged with status 429. Missing, unknown and already-revoked tokens are rejected before a key can be associated with a usage record.

## Automated lifecycle test

```bash
npm run test:lifecycle
```

The test uses a separate disposable SQLite database and verifies:
- Admin login and key creation
- Raw token is not stored (hash is stored)
- First request succeeds
- Second request exceeds a limit of one and returns 429
- Both authenticated calls appear exactly once in usage logs
- Revocation succeeds and the same token immediately returns 401
- Missing key returns 401

Expected terminal result:

`PASS: create, hashed storage, authorised use, daily limit, usage logging, revoke, revoked rejection, missing-key rejection.`

## Deliverables / evidence

Saved sample response files are in `evidence/`:
- `authorised.json`
- `unauthorised.json`
- `revoked.json`
- `rate-limited.json`
- `test-note.md`

Run the server and test locally to produce fresh responses for your environment. The screenshots are not fabricated; the evidence folder contains representative JSON response captures.

## Security notes

- Use HTTPS in deployment.
- Change the sample admin password and session secret before running.
- Keep `.env` and the SQLite database out of Git.
- Use a persistent session store (rather than Express's in-memory default) for production deployment.
- Consider adding admin login throttling and audit logging before exposing the dashboard publicly.
