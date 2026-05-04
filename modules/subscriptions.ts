/**
 * modules/subscriptions.ts
 */

import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const ZUPLO_ACCOUNT = "lavender-outstanding-bear";
const BASE = `https://dev.zuplo.com/v1/accounts/${ZUPLO_ACCOUNT}/key-buckets`;
const AUTH0_DOMAIN = "dev-l3ayzqncrfw3ta50.us.auth0.com";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const PORTAL_URL = "https://forest-river-demo-main-fb06bf1.zuplo.site";

// ─── Email via Resend ─────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string, context: ZuploContext): Promise<void> {
  const key = environment.RESEND_API_KEY;
  if (!key) { context.log.warn("RESEND_API_KEY not set"); return; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Forest River API <onboarding@resend.dev>", to: [to], subject, html }),
  });
  if (res.ok) context.log.info("Email sent to " + to);
  else context.log.warn("Email failed to " + to);
}

function approvalHtml(companyName: string, planName: string, apiKey: string): string {
  return "<html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px'>"
    + "<div style='background:#026957;padding:24px;margin-bottom:24px'><h1 style='color:#fff;margin:0;font-size:20px'>Forest River Developer Portal</h1></div>"
    + "<h2 style='color:#026957'>Your API Access Has Been Approved</h2>"
    + "<p>Hi " + companyName + ",</p>"
    + "<p>Your request for <strong>" + planName + " Plan</strong> access has been approved.</p>"
    + "<div style='background:#f0f7f5;border-left:4px solid #026957;padding:16px;margin:24px 0'>"
    + "<p style='margin:0 0 8px 0;font-size:12px;color:#666;text-transform:uppercase'>Your API Key</p>"
    + "<code style='font-family:monospace;font-size:14px;color:#026957;word-break:break-all'>" + apiKey + "</code></div>"
    + "<p>Include your key in every request: <code>Authorization: Bearer " + apiKey + "</code></p>"
    + "<p><a href='" + PORTAL_URL + "/api' style='display:inline-block;background:#026957;color:#fff;padding:12px 24px;text-decoration:none;font-weight:bold'>View API Reference</a></p>"
    + "<hr style='border:none;border-top:1px solid #e2e2e2;margin:24px 0'/>"
    + "<p style='font-size:12px;color:#666'>Questions? Visit the <a href='" + PORTAL_URL + "' style='color:#026957'>Forest River Developer Portal</a></p>"
    + "</body></html>";
}

function rejectionHtml(companyName: string, planName: string): string {
  return "<html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px'>"
    + "<div style='background:#026957;padding:24px;margin-bottom:24px'><h1 style='color:#fff;margin:0;font-size:20px'>Forest River Developer Portal</h1></div>"
    + "<h2>Update on Your API Access Request</h2>"
    + "<p>Hi " + companyName + ",</p>"
    + "<p>Your request for <strong>" + planName + " Plan</strong> access was not approved at this time.</p>"
    + "<p>Contact your Forest River integration representative if you believe this was an error.</p>"
    + "<p><a href='" + PORTAL_URL + "/subscribe' style='display:inline-block;background:#026957;color:#fff;padding:12px 24px;text-decoration:none;font-weight:bold'>View Plans</a></p>"
    + "<hr style='border:none;border-top:1px solid #e2e2e2;margin:24px 0'/>"
    + "<p style='font-size:12px;color:#666'><a href='" + PORTAL_URL + "' style='color:#026957'>Forest River Developer Portal</a></p>"
    + "</body></html>";
}

function adminEmailHtml(message: string): string {
  const msgHtml = message.split("\n").join("<br/>");
  return "<html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px'>"
    + "<div style='background:#026957;padding:24px;margin-bottom:24px'><h1 style='color:#fff;margin:0;font-size:20px'>Forest River Developer Portal</h1></div>"
    + "<div style='padding:0 0 24px 0'>" + msgHtml + "</div>"
    + "<hr style='border:none;border-top:1px solid #e2e2e2;margin:24px 0'/>"
    + "<p style='font-size:12px;color:#666'>You are receiving this as an authorized Forest River API partner. <a href='" + PORTAL_URL + "' style='color:#026957'>Visit the Developer Portal</a></p>"
    + "</body></html>";
}

// ─── Turnstile ────────────────────────────────────────────────────────────────

async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = environment.TURNSTILE_SECRET;
  if (!secret) { console.warn("TURNSTILE_SECRET not set"); return true; }
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch { return false; }
}

// ─── Auth0 userinfo ───────────────────────────────────────────────────────────

async function getUserEmail(request: ZuploRequest): Promise<string> {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    if (!token) return "";
    const res = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return "";
    const profile = await res.json() as { email?: string };
    return profile.email ?? "";
  } catch { return ""; }
}

// ─── Zuplo management API ─────────────────────────────────────────────────────

function zuploHeaders() {
  return { Authorization: `Bearer ${environment.API_KEY}`, "Content-Type": "application/json" };
}

function bucket() { return environment.BUCKET_NAME; }

async function zuploGet(path: string) {
  const res = await fetch(`${BASE}/${bucket()}${path}`, { headers: zuploHeaders() });
  if (!res.ok) throw new Error(`Zuplo GET ${path} failed: ${await res.text()}`);
  return res.json();
}

async function zuploPost(path: string, body: unknown) {
  const res = await fetch(`${BASE}/${bucket()}${path}`, {
    method: "POST", headers: zuploHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Zuplo POST ${path} failed: ${await res.text()}`);
  return res.json();
}

async function zuploPatch(path: string, body: unknown) {
  const res = await fetch(`${BASE}/${bucket()}${path}`, {
    method: "PATCH", headers: zuploHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Zuplo PATCH ${path} failed: ${await res.text()}`);
  return res.json();
}

async function zuploDelete(path: string) {
  const res = await fetch(`${BASE}/${bucket()}${path}`, { method: "DELETE", headers: zuploHeaders() });
  if (!res.ok && res.status !== 404) throw new Error(`Zuplo DELETE ${path} failed: ${await res.text()}`);
}

function keyRollHtml(companyName: string, planName: string, newKey: string, oldKeyExpiry: string): string {
  const expiry = new Date(oldKeyExpiry).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
  return "<html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px'>"
    + "<div style='background:#026957;padding:24px;margin-bottom:24px'><h1 style='color:#fff;margin:0;font-size:20px'>Forest River Developer Portal</h1></div>"
    + "<h2 style='color:#026957'>Your API Key Has Been Rolled</h2>"
    + "<p>Hi " + companyName + ",</p>"
    + "<p>Your <strong>" + planName + " Plan</strong> API key has been rolled. Your new key is below.</p>"
    + "<div style='background:#f0f7f5;border-left:4px solid #026957;padding:16px;margin:24px 0'>"
    + "<p style='margin:0 0 8px 0;font-size:12px;color:#666;text-transform:uppercase'>New API Key</p>"
    + "<code style='font-family:monospace;font-size:14px;color:#026957;word-break:break-all'>" + newKey + "</code></div>"
    + "<div style='background:#fff8e1;border-left:4px solid #f59e0b;padding:16px;margin:24px 0'>"
    + "<p style='margin:0;font-size:13px;color:#92400e'>⚠️ <strong>Your old key expires " + expiry + ".</strong> Both keys work until then. Update your integration before this deadline.</p></div>"
    + "<p>Include your new key in every request: <code>Authorization: Bearer " + newKey + "</code></p>"
    + "<p><a href='" + PORTAL_URL + "/my-subscriptions' style='display:inline-block;background:#026957;color:#fff;padding:12px 24px;text-decoration:none;font-weight:bold'>View My Subscriptions</a></p>"
    + "<hr style='border:none;border-top:1px solid #e2e2e2;margin:24px 0'/>"
    + "<p style='font-size:12px;color:#666'>Questions? Visit the <a href='" + PORTAL_URL + "' style='color:#026957'>Forest River Developer Portal</a></p>"
    + "</body></html>";
}

function offboardHtml(companyName: string, planName: string): string {
  return "<html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px'>"
    + "<div style='background:#026957;padding:24px;margin-bottom:24px'><h1 style='color:#fff;margin:0;font-size:20px'>Forest River Developer Portal</h1></div>"
    + "<h2>Forest River API Access Terminated</h2>"
    + "<p>Hi " + companyName + ",</p>"
    + "<p>Your <strong>" + planName + " Plan</strong> API access has been permanently revoked. All API keys associated with your account have been deleted and will no longer function.</p>"
    + "<p>If you believe this was an error, please contact your Forest River integration representative.</p>"
    + "<hr style='border:none;border-top:1px solid #e2e2e2;margin:24px 0'/>"
    + "<p style='font-size:12px;color:#666'>Forest River, Inc. — API Program</p>"
    + "</body></html>";
}

// ─── Consumer helpers ─────────────────────────────────────────────────────────

interface ZuploConsumer {
  id: string; name: string; description?: string;
  tags?: Record<string, string>;
  metadata?: Record<string, string>;
  apiKeys?: { id: string; key?: string }[];
}

async function listConsumers(): Promise<ZuploConsumer[]> {
  const data = await zuploGet("/consumers?limit=1000") as { data: ZuploConsumer[] };
  return data.data ?? [];
}

async function getConsumerWithKey(consumerName: string): Promise<ZuploConsumer> {
  return zuploGet(`/consumers/${consumerName}?include-api-keys=true&key-format=visible`) as Promise<ZuploConsumer>;
}

function subToConsumerName(sub: string, planId: string): string {
  return `${sub.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 100)}-${planId}`;
}

function consumerToSubscription(c: ZuploConsumer, apiKey?: string) {
  return {
    id: c.name,
    planId: c.tags?.["plan"] ?? "basic",
    planName: c.metadata?.["planName"] ?? c.tags?.["plan"] ?? "Basic",
    userId: c.metadata?.["userId"] ?? "",
    userEmail: c.metadata?.["email"] ?? "",
    companyName: c.metadata?.["companyName"] ?? "",
    dealerId: c.metadata?.["dealerId"] ?? "",
    useCase: c.metadata?.["useCase"] ?? "",
    expectedVolume: c.metadata?.["expectedVolume"] ?? "",
    webhookUrl: c.metadata?.["webhookUrl"] ?? "",
    tosAccepted: c.metadata?.["tosAccepted"] === "true",
    tosAcceptedAt: c.metadata?.["tosAcceptedAt"] ?? "",
    status: (c.tags?.["status"] ?? "pending") as string,
    apiKey,
    requestedAt: c.metadata?.["requestedAt"] ?? new Date().toISOString(),
    resolvedAt: c.metadata?.["resolvedAt"],
    portalMessage: c.metadata?.["portalMessage"] ?? "",
    portalMessageType: (c.metadata?.["portalMessageType"] ?? "info") as "info" | "warning" | "success",
  };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/** POST /subscriptions */
export async function createSubscription(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const body = await request.json() as {
    planId: string; planName: string;
    companyName?: string; dealerId?: string; useCase?: string;
    expectedVolume?: string; webhookUrl?: string;
    tosAccepted?: boolean; tosAcceptedAt?: string;
    turnstileToken?: string;
  };

  if (body.turnstileToken) {
    const ip = request.headers.get("CF-Connecting-IP") ?? undefined;
    const valid = await verifyTurnstile(body.turnstileToken, ip);
    if (!valid) {
      context.log.warn("Turnstile verification failed");
      return new Response(JSON.stringify({ error: "Bot protection challenge failed. Please try again." }), { status: 403 });
    }
  }

  const userId = request.user.sub!;
  const userEmail = await getUserEmail(request);
  const consumerName = subToConsumerName(userId, body.planId);

  try {
    const existing = await getConsumerWithKey(consumerName);
    const apiKey = existing.tags?.["status"] === "active" ? existing.apiKeys?.[0]?.key : undefined;
    return new Response(JSON.stringify(consumerToSubscription(existing, apiKey)), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch { /* create new */ }

  const isBasic = body.planId === "basic";
  const consumer = await zuploPost(`/consumers`, {
    name: consumerName,
    description: (body.companyName || userEmail) + " — " + body.planName + " plan",
    tags: { plan: body.planId, status: isBasic ? "active" : "pending" },
    metadata: {
      userId, email: userEmail, planName: body.planName,
      companyName: body.companyName ?? "", dealerId: body.dealerId ?? "",
      useCase: body.useCase ?? "", expectedVolume: body.expectedVolume ?? "",
      webhookUrl: body.webhookUrl ?? "",
      tosAccepted: body.tosAccepted ? "true" : "false", tosAcceptedAt: body.tosAcceptedAt ?? "",
      requestedAt: new Date().toISOString(),
      ...(isBasic ? { resolvedAt: new Date().toISOString() } : {}),
    },
  }) as ZuploConsumer;

  let apiKey: string | undefined;
  if (isBasic) {
    const keyData = await zuploPost(`/consumers/${consumerName}/keys`, { description: body.planId + " key for " + userEmail }) as { key: string };
    apiKey = keyData.key;
  }

  return new Response(JSON.stringify(consumerToSubscription(consumer, apiKey)), { status: 201, headers: { "Content-Type": "application/json" } });
}

/** GET /subscriptions */
export async function getMySubscriptions(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const userId = request.user.sub!;
  const all = await listConsumers();
  const mine = all.filter(c => c.metadata?.["userId"] === userId);
  const subscriptions = await Promise.all(mine.map(async (c) => {
    try {
      const withKey = await getConsumerWithKey(c.name);
      const apiKey = withKey.tags?.["status"] === "active" ? withKey.apiKeys?.[0]?.key : undefined;
      return consumerToSubscription(withKey, apiKey);
    } catch { return consumerToSubscription(c); }
  }));
  return new Response(JSON.stringify(subscriptions), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** GET /admin/subscriptions */
export async function adminGetSubscriptions(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const consumers = await listConsumers();
  return new Response(JSON.stringify(consumers.map(c => consumerToSubscription(c))), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** POST /admin/subscriptions/:id/approve */
export async function adminApproveSubscription(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const consumerName = request.params.id;
  const existing = await getConsumerWithKey(consumerName);
  const keyData = await zuploPost(`/consumers/${consumerName}/keys`, { description: "Approved subscription key" }) as { key: string };
  const updated = await zuploPatch(`/consumers/${consumerName}`, {
    tags: { ...existing.tags, status: "active" },
    metadata: { ...existing.metadata, resolvedAt: new Date().toISOString() },
  }) as ZuploConsumer;
  const email = existing.metadata?.["email"] ?? "";
  const company = existing.metadata?.["companyName"] || email || "Dealer";
  const plan = existing.metadata?.["planName"] ?? "API";
  context.waitUntil(sendEmail(email, "Your " + plan + " API Access is Approved", approvalHtml(company, plan, keyData.key), context));
  return new Response(JSON.stringify(consumerToSubscription(updated, keyData.key)), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** POST /admin/subscriptions/:id/reject */
export async function adminRejectSubscription(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const consumerName = request.params.id;
  const existing = await getConsumerWithKey(consumerName);
  const updated = await zuploPatch(`/consumers/${consumerName}`, {
    tags: { ...existing.tags, status: "rejected" },
    metadata: { ...existing.metadata, resolvedAt: new Date().toISOString() },
  }) as ZuploConsumer;
  const email = existing.metadata?.["email"] ?? "";
  const company = existing.metadata?.["companyName"] || email || "Dealer";
  const plan = existing.metadata?.["planName"] ?? "API";
  context.waitUntil(sendEmail(email, "Update on Your " + plan + " API Access Request", rejectionHtml(company, plan), context));
  return new Response(JSON.stringify(consumerToSubscription(updated)), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** POST /admin/subscriptions/:id/move */
export async function adminMoveSubscription(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const consumerName = request.params.id;
  const body = await request.json() as { planId: string; planName?: string };
  const existing = await getConsumerWithKey(consumerName);
  const updated = await zuploPatch(`/consumers/${consumerName}`, {
    tags: { ...existing.tags, plan: body.planId },
    metadata: { ...existing.metadata, planName: body.planName ?? body.planId, movedAt: new Date().toISOString() },
  }) as ZuploConsumer;
  context.log.info("Consumer " + consumerName + " moved to plan group: " + body.planId);
  return new Response(JSON.stringify(consumerToSubscription(updated)), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** POST /admin/announcements */
export async function adminPublishAnnouncement(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const body = await request.json() as { message: string; target: "all" | "basic" | "pro" | "enterprise"; type: "info" | "warning" | "success" };
  const consumers = await listConsumers();
  const targets = consumers.filter(c => {
    if (c.tags?.["status"] !== "active") return false;
    if (body.target === "all") return true;
    return c.tags?.["plan"] === body.target;
  });
  await Promise.all(targets.map(async (c) => {
    try {
      await zuploPatch(`/consumers/${c.name}`, {
        tags: { ...c.tags },
        metadata: { ...c.metadata, portalMessage: body.message, portalMessageType: body.type, portalMessageAt: new Date().toISOString() },
      });
    } catch (err) { context.log.error("Failed to patch consumer " + c.name, err); }
  }));
  return new Response(JSON.stringify({ updated: targets.length, target: body.target }), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** POST /admin/subscriptions/:id/announce */
export async function adminAnnounceToConsumer(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const consumerName = request.params.id;
  const body = await request.json() as { message: string; type: string };
  const existing = await getConsumerWithKey(consumerName);
  const updated = await zuploPatch(`/consumers/${consumerName}`, {
    tags: { ...existing.tags },
    metadata: { ...existing.metadata, portalMessage: body.message, portalMessageType: body.type, portalMessageAt: body.message ? new Date().toISOString() : "" },
  }) as ZuploConsumer;
  return new Response(JSON.stringify(consumerToSubscription(updated)), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** POST /admin/subscriptions/:id/suspend */
export async function adminSuspendSubscription(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const consumerName = request.params.id;
  const existing = await getConsumerWithKey(consumerName);
  const updated = await zuploPatch(`/consumers/${consumerName}`, {
    tags: { ...existing.tags, status: "suspended" },
    metadata: { ...existing.metadata, suspendedAt: new Date().toISOString() },
  }) as ZuploConsumer;
  return new Response(JSON.stringify(consumerToSubscription(updated)), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** POST /admin/subscriptions/:id/reinstate */
export async function adminReinstateSubscription(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const consumerName = request.params.id;
  const existing = await getConsumerWithKey(consumerName);
  const updated = await zuploPatch(`/consumers/${consumerName}`, {
    tags: { ...existing.tags, status: "active" },
    metadata: { ...existing.metadata, reinstatedAt: new Date().toISOString() },
  }) as ZuploConsumer;
  return new Response(JSON.stringify(consumerToSubscription(updated)), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** POST /admin/subscriptions/:id/roll-key  body: { gracePeriodHours?: number } */
export async function adminRollKey(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const consumerName = request.params.id;
  const body = await request.json() as { gracePeriodHours?: number };
  const gracePeriodHours = body.gracePeriodHours ?? 24;
  const oldKeyExpiry = new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000).toISOString();

  const existing = await getConsumerWithKey(consumerName);
  const oldKeyId = existing.apiKeys?.[0]?.id ?? "";

  const keyData = await zuploPost(`/consumers/${consumerName}/keys`, { description: "Rolled key — " + new Date().toISOString() }) as { key: string; id: string };

  const updated = await zuploPatch(`/consumers/${consumerName}`, {
    tags: { ...existing.tags, oldKeyId, oldKeyExpiry },
    metadata: { ...existing.metadata, keyRolledAt: new Date().toISOString() },
  }) as ZuploConsumer;

  const email = existing.metadata?.["email"] ?? "";
  const company = existing.metadata?.["companyName"] || email || "Dealer";
  const plan = existing.metadata?.["planName"] ?? "API";
  if (email) context.waitUntil(sendEmail(email, "Your Forest River API Key Has Been Rolled", keyRollHtml(company, plan, keyData.key, oldKeyExpiry), context));

  return new Response(JSON.stringify({ ...consumerToSubscription(updated), newApiKey: keyData.key, oldKeyExpiry }), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** DELETE /admin/subscriptions/:id  — full offboard */
export async function adminOffboardSubscription(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const consumerName = request.params.id;
  const existing = await getConsumerWithKey(consumerName);
  await zuploDelete(`/consumers/${consumerName}`);
  const email = existing.metadata?.["email"] ?? "";
  const company = existing.metadata?.["companyName"] || email || "Dealer";
  const plan = existing.metadata?.["planName"] ?? "API";
  if (email) context.waitUntil(sendEmail(email, "Your Forest River API Access Has Been Terminated", offboardHtml(company, plan), context));
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** POST /subscriptions/roll-key  body: { subscriptionId: string } — consumer self-service */
export async function rollMyKey(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const userId = request.user.sub!;
  const body = await request.json() as { subscriptionId: string };
  const consumerName = body.subscriptionId;
  const existing = await getConsumerWithKey(consumerName);
  if (existing.metadata?.["userId"] !== userId) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  if (existing.tags?.["status"] !== "active") return new Response(JSON.stringify({ error: "Subscription not active" }), { status: 400 });

  const oldKeyId = existing.apiKeys?.[0]?.id ?? "";
  const gracePeriodHours = 1;
  const oldKeyExpiry = new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000).toISOString();

  const keyData = await zuploPost(`/consumers/${consumerName}/keys`, { description: "Self-rolled key — " + new Date().toISOString() }) as { key: string; id: string };
  await zuploPatch(`/consumers/${consumerName}`, {
    tags: { ...existing.tags, oldKeyId, oldKeyExpiry },
    metadata: { ...existing.metadata, keyRolledAt: new Date().toISOString() },
  });

  const email = existing.metadata?.["email"] ?? "";
  const company = existing.metadata?.["companyName"] || email || "Dealer";
  const plan = existing.metadata?.["planName"] ?? "API";
  if (email) context.waitUntil(sendEmail(email, "Your Forest River API Key Has Been Rolled", keyRollHtml(company, plan, keyData.key, oldKeyExpiry), context));

  return new Response(JSON.stringify({ apiKey: keyData.key, oldKeyExpiry }), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** POST /admin/email */
export async function adminSendEmail(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const body = await request.json() as { subject: string; message: string; target: "all" | "basic" | "pro" | "enterprise" };
  const resendKey = environment.RESEND_API_KEY;
  if (!resendKey) return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500 });
  const consumers = await listConsumers();
  const targets = consumers.filter(c => {
    if (c.tags?.["status"] !== "active") return false;
    if (body.target === "all") return true;
    return c.tags?.["plan"] === body.target;
  });
  const emails = targets.map(c => c.metadata?.["email"]).filter((e): e is string => !!e && e.includes("@"));
  if (emails.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No consumers with email addresses found" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  const html = adminEmailHtml(body.message);
  context.waitUntil(Promise.all(emails.map(email => sendEmail(email, body.subject, html, context))));
  return new Response(JSON.stringify({ sent: emails.length, target: body.target }), { status: 200, headers: { "Content-Type": "application/json" } });
}