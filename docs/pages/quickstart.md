---
title: Quick Start
description: Get your first API call working in under 5 minutes
sidebar_label: Quick Start
---

This guide walks you through making your first authenticated request to the Forest River API.

## Prerequisites

Before you begin, make sure you have:

- An approved Forest River dealer account
- An API key from [My Subscriptions](/my-subscriptions) — if you haven't requested access yet, visit the [Plans](/subscribe) page first

## Make Your First Request

With your API key in hand, make a request to the vehicle inventory endpoint:

```bash
curl https://forest-river-demo-main-fb06bf1.zuplo.app/v2/vehicles \
  -H "Authorization: Bearer YOUR_API_KEY"
```

A successful response returns a list of vehicles in the v2 schema:

```json
[
  {
    "id": "veh-001",
    "make": "Forest River",
    "model": "Rockwood Ultra Lite 2892RB",
    "year": 2025,
    "type": "travel-trailer",
    "category": "Camping",
    "msrp": 42999,
    "dealerId": "d8f3a2b1-4c5e-4f6a-8b9c-1d2e3f4a5b6c",
    "available": true
  }
]
```

## Explore the API Reference

Use the interactive [API Reference](/api) to explore all available endpoints, view request/response schemas, and test calls directly in the browser using your API key.

## Check Your Rate Limits

Your plan's rate limit is enforced per API key. Response headers on every request show your current usage:

```
ratelimit-limit: 15
ratelimit-remaining: 14
ratelimit-reset: 60
```

| Plan | Rate Limit | Monthly Quota |
|------|-----------|---------------|
| Basic | 100 req/min | 50,000 |
| Pro | 15 req/min | 5,000,000 |
| Enterprise | Unlimited | Unlimited |

## Next Steps

- Read the [Authentication](/authentication) guide for advanced credential management
- Review the [Migration Guide](/migration-guide) if you are upgrading from v1
- Contact your Forest River integration representative for production support