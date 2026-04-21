/**
 * modules/subscriptions.ts
 *
 * Subscription request store backed by Zuplo KV (ZuploContext.store).
 * Also handles API key provisioning via the Zuplo API key management API.
 */

import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const STORE_KEY = "subscription-requests";
const ZUPLO_ACCOUNT = "lavender-outstanding-bear";
const ZUPLO_PROJECT = "forest-river-demo";
const ZUPLO_ENV = "working-copy";

export interface SubscriptionRequest {
  id: string;
  planId: "basic" | "pro" | "enterprise";
  planName: string;
  userId: string;     // Auth0 sub
  userEmail: string;
  userName: string;
  status: "pending" | "active" | "rejected";
  apiKey?: string;
  requestedAt: string;
  resolvedAt?: string;
}

// ─── KV helpers ──────────────────────────────────────────────────────────────

async function loadRequests(context: ZuploContext): Promise<SubscriptionRequest[]> {
  try {
    const raw = await context.store.get(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveRequests(context: ZuploContext, requests: SubscriptionRequest[]): Promise<void> {
  await context.store.put(STORE_KEY, JSON.stringify(requests));
}

// ─── Zuplo API key provisioning ───────────────────────────────────────────────

async function provisionApiKey(
  userId: string,
  userEmail: string,
  planId: string,
  subId: string
): Promise<string> {
  const apiKey = environment.ZUPLO_API_KEY;
  const bucketName = environment.ZUPLO_BUCKET_NAME;

  // Create consumer
  const consumerRes = await fetch(
    `https://api.zuplo.com/v1/accounts/${ZUPLO_ACCOUNT}/projects/${ZUPLO_PROJECT}/environments/${ZUPLO_ENV}/api-key-consumers`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: userId,
        description: `${userEmail} — ${planId} plan`,
        metadata: {
          email: userEmail,
          plan: planId,
          subscriptionId: subId,
        },
      }),
    }
  );

  if (!consumerRes.ok) {
    const err = await consumerRes.text();
    throw new Error(`Failed to create consumer: ${err}`);
  }

  const consumer = await consumerRes.json();

  // Create API key for consumer
  const keyRes = await fetch(
    `https://api.zuplo.com/v1/accounts/${ZUPLO_ACCOUNT}/projects/${ZUPLO_PROJECT}/environments/${ZUPLO_ENV}/api-key-consumers/${consumer.id}/api-keys`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: `${planId} key for ${userEmail}`,
        bucketName,
      }),
    }
  );

  if (!keyRes.ok) {
    const err = await keyRes.text();
    throw new Error(`Failed to create API key: ${err}`);
  }

  const key = await keyRes.json();
  return key.key;
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/** POST /subscriptions — consumer submits a request */
export async function createSubscription(request: ZuploRequest, context: ZuploContext) {
  const user = request.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json() as { planId: string; planName: string };
  const { planId, planName } = body;

  const requests = await loadRequests(context);

  // Check for existing non-rejected request for this user+plan
  const existing = requests.find(
    r => r.userId === user.sub && r.planId === planId as any && r.status !== "rejected"
  );
  if (existing) {
    return new Response(JSON.stringify(existing), { status: 200 });
  }

  const newRequest: SubscriptionRequest = {
    id: crypto.randomUUID(),
    planId: planId as any,
    planName,
    userId: user.sub!,
    userEmail: (user.data as any)?.email || user.sub!,
    userName: (user.data as any)?.name || user.sub!,
    status: planId === "basic" ? "active" : "pending",
    requestedAt: new Date().toISOString(),
  };

  // Auto-provision key for basic plan
  if (planId === "basic") {
    try {
      newRequest.apiKey = await provisionApiKey(
        user.sub!,
        newRequest.userEmail,
        planId,
        newRequest.id
      );
      newRequest.resolvedAt = new Date().toISOString();
    } catch (err) {
      context.log.error("Failed to provision basic key", err);
      return new Response(JSON.stringify({ error: "Failed to provision key" }), { status: 500 });
    }
  }

  requests.push(newRequest);
  await saveRequests(context, requests);

  return new Response(JSON.stringify(newRequest), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

/** GET /subscriptions — consumer polls for their subscription status */
export async function getMySubscriptions(request: ZuploRequest, context: ZuploContext) {
  const user = request.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const requests = await loadRequests(context);
  const mine = requests.filter(r => r.userId === user.sub);

  return new Response(JSON.stringify(mine), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** GET /admin/subscriptions — admin sees all pending requests */
export async function adminGetSubscriptions(request: ZuploRequest, context: ZuploContext) {
  const user = request.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const requests = await loadRequests(context);
  return new Response(JSON.stringify(requests), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** POST /admin/subscriptions/:id/approve — admin approves, provisions real key */
export async function adminApproveSubscription(request: ZuploRequest, context: ZuploContext) {
  const user = request.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const id = request.params.id;
  const requests = await loadRequests(context);
  const sub = requests.find(r => r.id === id);

  if (!sub) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }
  if (sub.status !== "pending") {
    return new Response(JSON.stringify({ error: "Already resolved" }), { status: 400 });
  }

  try {
    sub.apiKey = await provisionApiKey(sub.userId, sub.userEmail, sub.planId, sub.id);
    sub.status = "active";
    sub.resolvedAt = new Date().toISOString();
  } catch (err) {
    context.log.error("Failed to provision key on approval", err);
    return new Response(JSON.stringify({ error: "Failed to provision key" }), { status: 500 });
  }

  await saveRequests(context, requests);
  return new Response(JSON.stringify(sub), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** POST /admin/subscriptions/:id/reject — admin rejects */
export async function adminRejectSubscription(request: ZuploRequest, context: ZuploContext) {
  const user = request.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const id = request.params.id;
  const requests = await loadRequests(context);
  const sub = requests.find(r => r.id === id);

  if (!sub) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }

  sub.status = "rejected";
  sub.resolvedAt = new Date().toISOString();
  await saveRequests(context, requests);

  return new Response(JSON.stringify(sub), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
