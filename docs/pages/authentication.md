---
title: Authentication
description: How to authenticate requests to the Forest River API
sidebar_label: Authentication
---

The Forest River API uses API keys for authentication. Every request must include a valid API key in the `Authorization` header.

## API Keys

API keys are issued through the developer portal after your subscription request is approved. Each key is:

- **Scoped to your dealership** — tied to your Auth0 identity and dealer profile
- **Plan-aware** — carries the rate limits of your subscription tier
- **Immediately revocable** — can be revoked from the portal at any time

## Making Authenticated Requests

Include your API key as a Bearer token in the `Authorization` header:

```bash
curl https://forest-river-demo-main-fb06bf1.zuplo.app/v2/vehicles \
  -H "Authorization: Bearer YOUR_API_KEY"
```

```javascript
const response = await fetch('https://forest-river-demo-main-fb06bf1.zuplo.app/v2/vehicles', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
```

```python
import requests

response = requests.get(
  'https://forest-river-demo-main-fb06bf1.zuplo.app/v2/vehicles',
  headers={'Authorization': 'Bearer YOUR_API_KEY'}
)
```

## Managing Your Keys

API keys are visible in [My Subscriptions](/my-subscriptions) after your request is approved. From there you can:

- **Copy** your key to use in your integration
- **View** your current plan and rate limits
- **Revoke** a key if it has been compromised

If you need a new key, revoke the existing one and contact your Forest River integration representative to request a replacement.

## Error Responses

| Status | Meaning |
|--------|---------|
| `401 Unauthorized` | Missing or invalid API key |
| `429 Too Many Requests` | Rate limit exceeded — check `ratelimit-reset` header |
| `403 Forbidden` | Valid key but insufficient permissions for this endpoint |

## OAuth 2.0 (Advanced)

For server-to-server integrations that require short-lived tokens, the Forest River API also supports OAuth 2.0 Client Credentials flow via Auth0. Contact your integration representative to obtain client credentials for this flow.

## Terms of Service

By using the Forest River API you agree to the [Forest River API Terms of Service](https://www.forestriverinc.com). API access is restricted to authorized Forest River dealer partners and integration platforms.