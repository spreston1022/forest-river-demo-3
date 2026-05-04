---
title: API v1 Deprecation & Migration Guide
sidebar_label: Migration Guide
sidebar_icon: alert-triangle
---

:::danger{title="⚠️ API v1 Retiring May 30, 2026"}
Forest River API v1 will be permanently retired on **May 30, 2026**. All integrations must migrate to v2 before this date. After sunset, v1 requests will return `410 Gone`.
:::

## Timeline

| Date | Event |
|------|-------|
| January 15, 2026 | v1 officially deprecated — deprecation headers added to all v1 responses |
| April 1, 2026 | Brownout periods begin — scheduled v1 disruptions to encourage migration |
| **May 30, 2026** | **v1 permanently retired — all v1 requests return `410 Gone`** |

## What's Changing in v2

Forest River's dealer management system has migrated to a new platform. v2 reflects this change with two breaking updates to the vehicle inventory API:

### 1. `dealerCode` replaced by `dealerId`

The short alphanumeric dealer code used in v1 has been replaced by a UUID-based dealer ID aligned with the new dealer management system.

**v1 response:**
```json
{
  "id": "veh-001",
  "model": "Rockwood Ultra Lite 2892RB",
  "dealerCode": "FR-1234"
}
```

**v2 response:**
```json
{
  "id": "veh-001",
  "model": "Rockwood Ultra Lite 2892RB",
  "dealerId": "d8f3a2b1-4c5e-4f6a-8b9c-1d2e3f4a5b6c"
}
```

To map your existing `dealerCode` values to the new `dealerId` UUIDs, contact your Forest River integration representative or use the dealer lookup endpoint in v2.

### 2. New `category` field

v2 introduces a `category` field that groups vehicles into Forest River's product lines. This field is required in v2 responses.

| Category | Vehicle Types |
|----------|--------------|
| `Camping` | Travel trailers, fifth wheels, motorhomes |
| `Work & Play` | Toy haulers, cargo trailers |
| `Marine` | Pontoon boats, center console, deck boats |
| `Specialty` | All other vehicle types |

## How to Migrate

### Step 1 — Update your endpoint URL

```bash
# Before
GET /v1/vehicles

# After  
GET /v2/vehicles
```

Your API key stays the same — no re-provisioning needed.

### Step 2 — Update your dealer ID references

Replace any use of `dealerCode` in your integration with `dealerId`. Contact your integration representative to obtain the UUID mapping for your dealer codes.

### Step 3 — Handle the new `category` field

The `category` field is returned on all v2 vehicle records. Update your data models to include it. If you don't need it, you can safely ignore it.

### Step 4 — Test against v2

Use the [API Reference](/api) to test your integration against the v2 endpoints before your go-live date.

## Detecting Deprecation in Your Integration

All v1 responses include standard HTTP deprecation headers:

```
Deprecation: Wed, 15 Jan 2026 00:00:00 GMT
Sunset: Wed, 01 Jul 2026 00:00:00 GMT  
Link: <https://forest-river-demo-main-fb06bf1.zuplo.site/api>; rel="deprecation"
```

Many HTTP clients and API monitoring tools can be configured to alert on these headers. We recommend setting up alerts now.

## Support

:::info{title="Need help migrating?"}
Contact your Forest River integration representative or email **api-support@forestriverinc.com** for migration assistance. We're committed to making this transition as smooth as possible for all dealer partners.
:::

## Frequently Asked Questions

**Does my API key change when I migrate to v2?**  
No. Your existing API key works on both v1 and v2. No re-provisioning needed.

**Will my rate limits change?**  
No. Your plan's rate limits apply equally to v1 and v2 endpoints.

**What happens if I'm still on v1 after May 30?**  
All v1 requests will return `410 Gone`. Your integration will stop working until you migrate to v2.

**Can I call both v1 and v2 during my migration period?**  
Yes. Both versions are live simultaneously until the sunset date. You can migrate endpoint by endpoint.