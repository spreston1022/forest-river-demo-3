/**
 * modules/subscriptions.ts
 *
 * Uses Zuplo's API key consumer service as the data store.
 * Fetches email from Auth0 userinfo endpoint since it's not in the access token.
 *
 * Env vars required:
 *   API_KEY     — Zuplo management API key (zpka_...)
 *   BUCKET_NAME — Zuplo API key bucket name (zprj-...)
 */

import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const ZUPLO_ACCOUNT = "lavender-outstanding-bear";
const BASE = `https://dev.zuplo.com/v1/accounts/${ZUPLO_ACCOUNT}/key-buckets`;
const AUTH0_DOMAIN = "dev-l3ayzqncrfw3ta50.us.auth0.com";

// ─── Auth0 userinfo helper ────────────────────────────────────────────────────

async function getUserEmail(request: ZuploRequest): Promise<string> {
  try {
    const authHeader = request.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return "";

    const res = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return "";
    const profile = await res.json() as { email?: string };
    return profile.email ?? "";
  } catch {
    return "";
  }
}

// ─── Zuplo management API helpers ────────────────────────────────────────────

function zuploHeaders() {
  return {
    Authorization: `Bearer ${environment.API_KEY}`,
    "Content-Type": "application/json",
  };
}

function bucket() {
  return environment.BUCKET_NAME;
}

async function zuploGet(path: string) {
  const res = await fetch(`${BASE}/${bucket()}${path}`, { headers: zuploHeaders() });
  if (!res.ok) throw new Error(`Zuplo GET ${path} failed: ${await res.text()}`);
  return res.json();
}

async function zuploPost(path: string, body: unknown) {
  const res = await fetch(`${BASE}/${bucket()}${path}`, {
    method: "POST",
    headers: zuploHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Zuplo POST ${path} failed: ${await res.text()}`);
  return res.json();
}

async function zuploPatch(path: string, body: unknown) {
  const res = await fetch(`${BASE}/${bucket()}${path}`, {
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
  name: string;
  description?: string;
  tags?: Record<string, string>;
  metadata?: Record<string, string>;
  apiKeys?: { id: string; key?: string }[];
}

interface ConsumerList {
  data: ZuploConsumer[];
}

async function listConsumers(): Promise<ZuploConsumer[]> {
  const data = await zuploGet("/consumers?limit=1000") as ConsumerList;
  return data.data ?? [];
}

async function getConsumerWithKey(consumerName: string): Promise<ZuploConsumer> {
  return zuploGet(`/consumers/${consumerName}?include-api-keys=true&key-format=visible`) as Promise<ZuploConsumer>;
}

function subToConsumerName(sub: string, planId: string): string {
  const sanitized = sub.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 100);
  return `${sanitized}-${planId}`;
}

function consumerToSubscription(c: ZuploConsumer, apiKey?: string) {
  return {
    id: c.name,
    planId: c.tags?.["plan"] ?? "basic",
    planName: c.metadata?.["planName"] ?? c.tags?.["plan"] ?? "Basic",
    userId: c.metadata?.["userId"] ?? "",
    userEmail: c.metadata?.["email"] ?? "",
    status: c.tags?.["status"] ?? "pending",
    apiKey,
    requestedAt: c.metadata?.["requestedAt"] ?? new Date().toISOString(),
    resolvedAt: c.metadata?.["resolvedAt"],
  };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/** POST /subscriptions */
export async function createSubscription(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const userId = request.user.sub!;
  // Fetch email from Auth0 userinfo since it's not in the access token
  const userEmail = await getUserEmail(request);
  const body = await request.json() as { planId: string; planName: string };
  const { planId, planName } = body;

  const consumerName = subToConsumerName(userId, planId);

  // Check if consumer already exists
  try {
    const existing = await getConsumerWithKey(consumerName);
    const apiKey = existing.tags?.["status"] === "active"
      ? existing.apiKeys?.[0]?.key
      : undefined;
    return new Response(JSON.stringify(consumerToSubscription(existing, apiKey)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // Consumer doesn't exist yet — create it
  }

  const isBasic = planId === "basic";

  const consumer = await zuploPost(`/consumers`, {
    name: consumerName,
    description: `${userEmail} — ${planName} plan`,
    tags: {
      plan: planId,
      status: isBasic ? "active" : "pending",
    },
    metadata: {
      userId,
      email: userEmail,
      planName,
      requestedAt: new Date().toISOString(),
      ...(isBasic ? { resolvedAt: new Date().toISOString() } : {}),
    },
  }) as ZuploConsumer;

  let apiKey: string | undefined;
  if (isBasic) {
    const keyData = await zuploPost(`/consumers/${consumerName}/keys`, {
      description: `${planId} key for ${userEmail}`,
    }) as { key: string };
    apiKey = keyData.key;
  }

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
  const all = await listConsumers();
  const mine = all.filter(c => c.metadata?.["userId"] === userId);

  const subscriptions = await Promise.all(
    mine.map(async (c) => {
      if (c.tags?.["status"] === "active") {
        const withKey = await getConsumerWithKey(c.name);
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

/** GET /admin/subscriptions — admin sees all consumers */
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

  const consumerName = request.params.id;

  const keyData = await zuploPost(`/consumers/${consumerName}/keys`, {
    description: "Approved subscription key",
  }) as { key: string };

  const updated = await zuploPatch(`/consumers/${consumerName}`, {
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

  const consumerName = request.params.id;

  const updated = await zuploPatch(`/consumers/${consumerName}`, {
    tags: { status: "rejected" },
    metadata: { resolvedAt: new Date().toISOString() },
  }) as ZuploConsumer;

  return new Response(JSON.stringify(consumerToSubscription(updated)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}