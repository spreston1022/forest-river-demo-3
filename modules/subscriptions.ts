/**
 * modules/subscriptions.ts
 *
 * Uses Zuplo's own API key consumer service as the data store.
 * No external dependencies needed.
 *
 * Flow:
 *   - POST /subscriptions    → create consumer (no key yet) with tag status=pending
 *   - GET  /subscriptions    → list consumers by subject (Auth0 sub), return their status + key
 *   - GET  /admin/subscriptions          → list all consumers with tag status=pending or status=active
 *   - POST /admin/subscriptions/:id/approve → create API key for consumer, update tag to status=active
 *   - POST /admin/subscriptions/:id/reject  → update consumer tag to status=rejected
 *
 * Env vars required:
 *   API_KEY     — Zuplo management API key
 *   BUCKET_NAME — Zuplo API key bucket name
 */

import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const ZUPLO_ACCOUNT = "lavender-outstanding-bear";
const ZUPLO_PROJECT = "forest-river-demo";
const ZUPLO_ENV = "working-copy";
const BASE = `https://api.zuplo.com/v1/accounts/${ZUPLO_ACCOUNT}/projects/${ZUPLO_PROJECT}/environments/${ZUPLO_ENV}`;

// ─── Zuplo management API helpers ────────────────────────────────────────────

function zuploHeaders() {
  return {
    Authorization: `Bearer ${environment.API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function zuploGet(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: zuploHeaders() });
  if (!res.ok) throw new Error(`Zuplo GET ${path} failed: ${await res.text()}`);
  return res.json();
}

async function zuploPost(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: zuploHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Zuplo POST ${path} failed: ${await res.text()}`);
  return res.json();
}

async function zuploPatch(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: zuploHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Zuplo PATCH ${path} failed: ${await res.text()}`);
  return res.json();
}

// ─── Consumer helpers ─────────────────────────────────────────────────────────

interface ZuploConsumer {
  id: string;
  subject: string;
  description: string;
  tags: Record<string, string>;
  metadata: Record<string, string>;
  apiKeys?: { id: string; key?: string }[];
}

async function listConsumers(tag?: string): Promise<ZuploConsumer[]> {
  const qs = tag ? `?tag.${tag}` : "";
  const data = await zuploGet(`/api-key-consumers${qs}`) as { data: ZuploConsumer[] };
  return data.data ?? [];
}

async function getConsumersBySubject(subject: string): Promise<ZuploConsumer[]> {
  const all = await listConsumers();
  return all.filter(c => c.subject === subject);
}

async function getConsumerWithKey(consumerId: string): Promise<ZuploConsumer> {
  return zuploGet(`/api-key-consumers/${consumerId}?include-api-keys=true`) as Promise<ZuploConsumer>;
}

function consumerToSubscription(c: ZuploConsumer, key?: string) {
  return {
    id: c.id,
    planId: c.tags["plan"] ?? "basic",
    planName: c.metadata["planName"] ?? c.tags["plan"] ?? "Basic",
    userId: c.subject,
    userEmail: c.metadata["email"] ?? "",
    status: c.tags["status"] ?? "pending",
    apiKey: key,
    requestedAt: c.metadata["requestedAt"] ?? new Date().toISOString(),
    resolvedAt: c.metadata["resolvedAt"],
  };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/** POST /subscriptions */
export async function createSubscription(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const userId = request.user.sub!;
  const userEmail = (request.user.data as any)?.email ?? "";
  const body = await request.json() as { planId: string; planName: string };
  const { planId, planName } = body;

  // Check if consumer already exists for this user+plan
  const existing = await getConsumersBySubject(userId);
  const existingForPlan = existing.find(c => c.tags["plan"] === planId && c.tags["status"] !== "rejected");
  if (existingForPlan) {
    // Return existing subscription with key if active
    if (existingForPlan.tags["status"] === "active") {
      const withKey = await getConsumerWithKey(existingForPlan.id);
      const key = withKey.apiKeys?.[0]?.key;
      return new Response(JSON.stringify(consumerToSubscription(existingForPlan, key)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(consumerToSubscription(existingForPlan)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isBasic = planId === "basic";

  // Create consumer (without key for pro/enterprise, with key for basic)
  const consumer = await zuploPost(`/api-key-consumers${isBasic ? "?with-api-key=true" : ""}`, {
    subject: userId,
    description: `${userEmail} — ${planName} plan`,
    tags: {
      plan: planId,
      status: isBasic ? "active" : "pending",
    },
    metadata: {
      email: userEmail,
      planName,
      requestedAt: new Date().toISOString(),
      ...(isBasic ? { resolvedAt: new Date().toISOString() } : {}),
    },
  }) as ZuploConsumer & { apiKeys?: { key: string }[] };

  const apiKey = isBasic ? consumer.apiKeys?.[0]?.key : undefined;

  return new Response(JSON.stringify(consumerToSubscription(consumer, apiKey)), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

/** GET /subscriptions — consumer polls for their own subscriptions */
export async function getMySubscriptions(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const userId = request.user.sub!;
  const consumers = await getConsumersBySubject(userId);

  // Fetch keys for active consumers
  const subscriptions = await Promise.all(
    consumers.map(async (c) => {
      if (c.tags["status"] === "active") {
        const withKey = await getConsumerWithKey(c.id);
        return consumerToSubscription(c, withKey.apiKeys?.[0]?.key);
      }
      return consumerToSubscription(c);
    })
  );

  return new Response(JSON.stringify(subscriptions), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** GET /admin/subscriptions — admin sees all pending + active */
export async function adminGetSubscriptions(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const consumers = await listConsumers();
  const subscriptions = consumers.map(c => consumerToSubscription(c));

  return new Response(JSON.stringify(subscriptions), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** POST /admin/subscriptions/:id/approve */
export async function adminApproveSubscription(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const consumerId = request.params.id;

  // Create API key for this consumer
  const keyData = await zuploPost(`/api-key-consumers/${consumerId}/api-keys`, {
    description: "Approved subscription key",
    bucketName: environment.BUCKET_NAME,
  }) as { key: string };

  // Update consumer tags to mark as active
  const updated = await zuploPatch(`/api-key-consumers/${consumerId}`, {
    tags: { status: "active" },
    metadata: { resolvedAt: new Date().toISOString() },
  }) as ZuploConsumer;

  return new Response(JSON.stringify(consumerToSubscription(updated, keyData.key)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** POST /admin/subscriptions/:id/reject */
export async function adminRejectSubscription(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const consumerId = request.params.id;

  const updated = await zuploPatch(`/api-key-consumers/${consumerId}`, {
    tags: { status: "rejected" },
    metadata: { resolvedAt: new Date().toISOString() },
  }) as ZuploConsumer;

  return new Response(JSON.stringify(consumerToSubscription(updated)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}