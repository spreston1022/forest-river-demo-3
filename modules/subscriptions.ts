/**
 * modules/subscriptions.ts
 */

import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const ZUPLO_ACCOUNT = "lavender-outstanding-bear";
const BASE = `https://dev.zuplo.com/v1/accounts/${ZUPLO_ACCOUNT}/key-buckets`;
const AUTH0_DOMAIN = "dev-l3ayzqncrfw3ta50.us.auth0.com";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const PORTAL_URL = "https://forest-river-demo-main-fb06bf1.zuplo.site";

const STRIPE_PRICE_IDS: Record<string, string> = {
  catalog: "price_1TTpvPLNOfSyVPaCh1Y74XMw",
  commerce: "price_1TTpvlLNOfSyVPaC9PUBf7Sr",
  pro: "price_1TTpxTLNOfSyVPaCB4MUaQ5a",
  enterprise: "price_1TTpy5LNOfSyVPaCiQfabm92",
};

const METERING_BUCKET_ID = "bckt_2vednH8xqLal1GgMI5pLSoQQdHhxV5Fjt";

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

function approvedPendingPaymentHtml(companyName: string, planName: string): string {
  return "<html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px'>"
    + "<div style='background:#026957;padding:24px;margin-bottom:24px'><h1 style='color:#fff;margin:0;font-size:20px'>Forest River Developer Portal</h1></div>"
    + "<h2 style='color:#026957'>Your Access Request Has Been Approved</h2>"
    + "<p>Hi " + companyName + ",</p>"
    + "<p>Your request for <strong>" + planName + " Plan</strong> access has been approved. Complete your subscription to receive your API key.</p>"
    + "<p><a href='" + PORTAL_URL + "/my-subscriptions' style='display:inline-block;background:#026957;color:#fff;padding:12px 24px;text-decoration:none;font-weight:bold'>Complete Subscription →</a></p>"
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

// ─── Stripe REST helpers ──────────────────────────────────────────────────────

async function stripeRequest(method: string, path: string, body?: Record<string, string>): Promise<any> {
  const key = environment.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    ...(body ? { body: new URLSearchParams(body).toString() } : {}),
  });
  if (!res.ok) throw new Error(`Stripe ${method} ${path} failed: ${await res.text()}`);
  return res.json();
}

async function createStripeCustomer(email: string, name: string): Promise<string> {
  const customer = await stripeRequest("POST", "/v1/customers", {
    email,
    ...(name ? { name } : {}),
  });
  return customer.id as string;
}

async function createStripeSubscription(customerId: string, priceId: string): Promise<string> {
  const subscription = await stripeRequest("POST", "/v1/subscriptions", {
    customer: customerId,
    "items[0][price]": priceId,
    "payment_behavior": "allow_incomplete",
  });
  return subscription.id as string;
}

async function createStripeCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  consumerName: string,
): Promise<string> {
  const session = await stripeRequest("POST", "/v1/checkout/sessions", {
    customer: customerId,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    "metadata[consumerName]": consumerName,
  });
  return session.url as string;
}

async function verifyStripeWebhook(payload: string, sig: string, secret: string): Promise<boolean> {
  const parts = sig.split(",").reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split("=");
    if (k && v) acc[k] = v;
    return acc;
  }, {});
  const timestamp = parts["t"];
  const v1 = parts["v1"];
  if (!timestamp || !v1) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("");
  return expected === v1;
}

// ─── Zuplo metering API ───────────────────────────────────────────────────────

const METERING_BASE = `https://dev.zuplo.com/v3/metering/${METERING_BUCKET_ID}`;

function meteringHeaders() {
  return { Authorization: `Bearer ${environment.API_KEY}`, "Content-Type": "application/json" };
}

async function meteringPost(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${METERING_BASE}${path}`, {
    method: "POST", headers: meteringHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Metering POST ${path} failed: ${await res.text()}`);
  return res.json();
}

async function meteringGet(path: string): Promise<any> {
  const res = await fetch(`${METERING_BASE}${path}`, { headers: meteringHeaders() });
  if (!res.ok) throw new Error(`Metering GET ${path} failed: ${await res.text()}`);
  return res.json();
}

async function getOrCreateMeteringCustomer(
  consumerName: string,
  userId: string,
  email: string,
  companyName: string,
  context: ZuploContext,
): Promise<string> {
  try {
    const customer = await meteringPost("/customers", {
      name: companyName || email || consumerName,
      primaryEmail: email || undefined,
      key: userId,
      usageAttribution: { subjectKeys: [consumerName] },
    });
    context.log.info(`Metering customer created: ${customer.id}`);
    return customer.id as string;
  } catch (err) {
    const msg = String(err);
    if (!msg.includes("409") && !msg.includes("Conflict")) throw err;
    // Customer already exists — fetch it by key
    const list = await meteringGet(`/customers?key=${encodeURIComponent(userId)}`);
    const items: any[] = list.items ?? list;
    const existing = items.find((c: any) => c.key === userId);
    if (!existing) throw new Error(`Metering customer with key ${userId} not found after 409`);
    context.log.info(`Metering customer already exists: ${existing.id}`);
    return existing.id as string;
  }
}

async function createZuploMeteringSubscription(
  consumerName: string,
  userId: string,
  email: string,
  companyName: string,
  planKey: string,
  stripeCustomerId: string,
  context: ZuploContext,
): Promise<void> {
  const customerId = await getOrCreateMeteringCustomer(consumerName, userId, email, companyName, context);
  await meteringPost("/subscriptions", { customerId, planKey, stripeCustomerId });
  context.log.info(`Metering subscription created: ${consumerName} on plan ${planKey}`);
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
    oldKeyExpiry: c.tags?.["oldKeyExpiry"] ?? "",
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
    turnstileToken?: string; userEmail?: string;
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
  const userEmail = (await getUserEmail(request)) || body.userEmail || "";
  const consumerName = subToConsumerName(userId, body.planId);

  try {
    const existing = await getConsumerWithKey(consumerName);
    const apiKey = existing.tags?.["status"] === "active" ? existing.apiKeys?.[0]?.key : undefined;
    return new Response(JSON.stringify(consumerToSubscription(existing, apiKey)), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch { /* create new */ }

  const consumer = await zuploPost(`/consumers`, {
    name: consumerName,
    description: (body.companyName || userEmail) + " — " + body.planName + " plan",
    tags: { plan: body.planId, status: "pending" },
    metadata: {
      userId, email: userEmail, plan: body.planId, planName: body.planName,
      companyName: body.companyName ?? "", dealerId: body.dealerId ?? "",
      useCase: body.useCase ?? "", expectedVolume: body.expectedVolume ?? "",
      webhookUrl: body.webhookUrl ?? "",
      tosAccepted: body.tosAccepted ? "true" : "false", tosAcceptedAt: body.tosAcceptedAt ?? "",
      requestedAt: new Date().toISOString(),
    },
  }) as ZuploConsumer;

  return new Response(JSON.stringify(consumerToSubscription(consumer)), { status: 201, headers: { "Content-Type": "application/json" } });
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
  const planId = existing.tags?.["plan"] ?? "";
  const email = existing.metadata?.["email"] ?? "";
  const company = existing.metadata?.["companyName"] || email || "Dealer";
  const plan = existing.metadata?.["planName"] ?? "API";

  // Paid plans: create Stripe customer, then require user to complete Stripe Checkout
  if (["pro", "enterprise"].includes(planId)) {
    let stripeCustomerId = existing.metadata?.["stripeCustomerId"];
    if (!stripeCustomerId) {
      try {
        stripeCustomerId = await createStripeCustomer(email, company);
      } catch (err) {
        context.log.error("Stripe customer creation failed: " + String(err));
        return new Response(JSON.stringify({ error: "Failed to set up Stripe billing" }), { status: 500 });
      }
    }
    const updated = await zuploPatch(`/consumers/${consumerName}`, {
      tags: { ...existing.tags, status: "approved_pending_payment" },
      metadata: { ...existing.metadata, stripeCustomerId, resolvedAt: new Date().toISOString() },
    }) as ZuploConsumer;
    if (email) context.waitUntil(sendEmail(email, "Complete Your " + plan + " Subscription", approvedPendingPaymentHtml(company, plan), context));
    return new Response(JSON.stringify(consumerToSubscription(updated)), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  // Free plans: create Stripe customer + $0 subscription, then provision key
  let stripeCustomerId = existing.metadata?.["stripeCustomerId"];
  if (!stripeCustomerId) {
    stripeCustomerId = await createStripeCustomer(email, company);
    await zuploPatch(`/consumers/${consumerName}`, {
      tags: { ...existing.tags },
      metadata: { ...existing.metadata, stripeCustomerId },
    });
  }
  const priceId = STRIPE_PRICE_IDS[planId];
  if (!priceId) {
    return new Response(JSON.stringify({ error: "No price configured for plan: " + planId }), { status: 500 });
  }
  const stripeSubscriptionId = await createStripeSubscription(stripeCustomerId, priceId);
  const userId = existing.metadata?.["userId"] ?? "";
  await createZuploMeteringSubscription(consumerName, userId, email, company, planId, stripeCustomerId, context);
  const keyData = await zuploPost(`/consumers/${consumerName}/keys`, { description: "Approved subscription key" }) as { key: string };
  const updated = await zuploPatch(`/consumers/${consumerName}`, {
    tags: { ...existing.tags, status: "active" },
    metadata: { ...existing.metadata, stripeCustomerId, stripeSubscriptionId, resolvedAt: new Date().toISOString() },
  }) as ZuploConsumer;
  if (email) context.waitUntil(sendEmail(email, "Your " + plan + " API Access is Approved", approvalHtml(company, plan, keyData.key), context));
  return new Response(JSON.stringify(consumerToSubscription(updated, keyData.key)), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** POST /subscriptions/checkout */
export async function createCheckoutSession(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const userId = request.user.sub!;
  const body = await request.json() as { subscriptionId: string };
  const consumerName = body.subscriptionId;

  const existing = await getConsumerWithKey(consumerName);
  if (existing.metadata?.["userId"] !== userId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
  if (existing.tags?.["status"] !== "approved_pending_payment") {
    return new Response(JSON.stringify({ error: "Subscription not awaiting payment" }), { status: 400 });
  }

  const stripeCustomerId = existing.metadata?.["stripeCustomerId"];
  if (!stripeCustomerId) {
    return new Response(JSON.stringify({ error: "Stripe customer not found — please contact support" }), { status: 500 });
  }

  const planId = existing.tags?.["plan"] ?? "";
  const priceId = STRIPE_PRICE_IDS[planId];
  if (!priceId) {
    return new Response(JSON.stringify({ error: "Unknown plan" }), { status: 400 });
  }

  const checkoutUrl = await createStripeCheckoutSession(
    stripeCustomerId, priceId,
    `${PORTAL_URL}/my-subscriptions?checkout=success`,
    `${PORTAL_URL}/my-subscriptions?checkout=cancelled`,
    consumerName,
  );

  return new Response(JSON.stringify({ url: checkoutUrl }), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** POST /webhooks/stripe */
export async function handleStripeWebhook(request: ZuploRequest, context: ZuploContext) {
  const sig = request.headers.get("stripe-signature") ?? "";
  const secret = environment.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    context.log.error("STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const payload = await request.text();
  const valid = await verifyStripeWebhook(payload, sig, secret);
  if (!valid) {
    context.log.warn("Invalid Stripe webhook signature");
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, any> } };
  context.log.info("Stripe webhook: " + event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const consumerName = session["metadata"]?.["consumerName"] as string | undefined;
    if (!consumerName) {
      context.log.warn("No consumerName in Stripe checkout session metadata");
      return new Response("OK", { status: 200 });
    }
    context.waitUntil((async () => {
      try {
        const existing = await getConsumerWithKey(consumerName);
        if (existing.tags?.["status"] === "approved_pending_payment") {
          const stripeSubscriptionId = (session["subscription"] as string) ?? "";
          const stripeCustomerId = existing.metadata?.["stripeCustomerId"] ?? (session["customer"] as string) ?? "";
          const userId = existing.metadata?.["userId"] ?? "";
          const planId = existing.tags?.["plan"] ?? "";
          const webhookEmail = existing.metadata?.["email"] ?? "";
          const webhookCompany = existing.metadata?.["companyName"] || webhookEmail || "Dealer";
          await createZuploMeteringSubscription(consumerName, userId, webhookEmail, webhookCompany, planId, stripeCustomerId, context);
          const keyData = await zuploPost(`/consumers/${consumerName}/keys`, { description: "Subscription key" }) as { key: string };
          await zuploPatch(`/consumers/${consumerName}`, {
            tags: { ...existing.tags, status: "active" },
            metadata: {
              ...existing.metadata,
              resolvedAt: new Date().toISOString(),
              stripeSubscriptionId,
            },
          });
          const email = existing.metadata?.["email"] ?? "";
          const company = existing.metadata?.["companyName"] || email || "Dealer";
          const plan = existing.metadata?.["planName"] ?? "API";
          if (email) await sendEmail(email, "Your " + plan + " API Access is Now Active", approvalHtml(company, plan, keyData.key), context);
          context.log.info("Key provisioned for " + consumerName + " after Stripe checkout");
        }
      } catch (err) {
        context.log.error("Failed to process checkout for " + consumerName + ": " + String(err));
      }
    })());
  }

  return new Response("OK", { status: 200 });
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
  if (email) context.waitUntil(sendEmail(email, "Update on Your " + plan + " API Access Request", rejectionHtml(company, plan), context));
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
