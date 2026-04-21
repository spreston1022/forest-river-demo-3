---
title: Authentication
---

# Authentication

## API Key (all plans)

Pass your key as a Bearer token on every request:

```
Authorization: Bearer YOUR_API_KEY
```

## OAuth 2.0 — Client Credentials (Pro / Enterprise)

For server-to-server integrations. Exchange client credentials at your IdP for a bearer token.

## OAuth 2.0 — Authorization Code + PKCE (Pro / Enterprise)

For user-facing apps. Use your IdP's authorization endpoint with PKCE and exchange the code for a bearer token.

## Key rotation

Regenerate your key at any time from /my-subscriptions. The old key is invalidated immediately.
