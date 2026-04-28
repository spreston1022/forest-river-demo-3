/**
 * modules/subscriptions.ts
 *
 * Includes Cloudflare Turnstile token validation on POST /subscriptions.
 * Env vars required:
 *   API_KEY            — Zuplo management API key
 *   BUCKET_NAME        — Zuplo API key bucket name
 *   TURNSTILE_SECRET   — Cloudflare Turnstile secret key
 */

import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const ZUPLO_ACCOUNT = "lavender-outstanding-bear";
const BASE = `https://dev.zuplo.com/v1/accounts/${ZUPLO_ACCOUNT}/key-buckets`;
const AUTH0_DOMAIN = "dev-l3ayzqncrfw3ta50.us.auth0.com";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// ─── Email notifications via Resend ──────────────────────────────────────────

async function sendApprovalEmail(
  toEmail: string,
  companyName: string,
  planName: string,
  apiKey: string,
  context: ZuploContext
): Promise<void> {
  const resendKey = environment.RESEND_API_KEY;
  if (!resendKey) {
    context.log.warn("RESEND_API_KEY not set — skipping approval email");
    return;
  }

  const portalUrl = "https://forest-river-demo-main-fb06bf1.zuplo.site";

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #232323;">
      <div style="background-color: #026957; padding: 24px; margin-bottom: 24px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Forest River Developer Portal</h1>
      </div>
      
      <h2 style="color: #026957;">Your API Access Has Been Approved</h2>
      
      <p>Hi ${companyName},</p>
      
      <p>Great news! Your request for <strong>${planName} Plan</strong> access to the Forest River API has been approved.</p>
      
      <div style="background-color: #f0f7f5; border-left: 4px solid #026957; padding: 16px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #666666; text-transform: uppercase; letter-spacing: 0.05em;">Your API Key</p>
        <code style="font-family: monospace; font-size: 14px; color: #026957; word-break: break-all;">${apiKey}</code>
      </div>
      
      <p>Keep this key secure — treat it like a password. You can view and manage your subscriptions in the developer portal.</p>
      
      <div style="margin: 24px 0;">
        <h3 style="color: #026957;">Getting Started</h3>
        <p>Include your API key in the <code>Authorization</code> header of every request:</p>
        <div style="background-color: #f5f5f5; padding: 12px; font-family: monospace; font-size: 13px;">
          Authorization: Bearer ${apiKey}
        </div>
      </div>
      
      <p>
        <a href="${portalUrl}/api" style="display: inline-block; background-color: #026957; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold;">View API Reference</a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #e2e2e2; margin: 24px 0;" />
      <p style="font-size: 12px; color: #666666;">
        If you have questions, visit the <a href="${portalUrl}" style="color: #026957;">Forest River Developer Portal</a> or contact your integration representative.
      </p>
    </body>
    </html>
  `;

  const { ok } = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Forest River API <onboarding@resend.dev>",
      to: [toEmail],
      subject: `Your ${planName} API Access is Approved`,
      html,
    }),
  });

  if (ok) {
    context.log.info(`Approval email sent to ${toEmail}`);
  } else {
    context.log.warn(`Failed to send approval email to ${toEmail}`);
  }
}

async function sendRejectionEmail(
  toEmail: string,
  companyName: string,
  planName: string,
  context: ZuploContext
): Promise<void> {
  const resendKey = environment.RESEND_API_KEY;
  if (!resendKey) {
    context.log.warn("RESEND_API_KEY not set — skipping rejection email");
    return;
  }

  const portalUrl = "https://forest-river-demo-main-fb06bf1.zuplo.site";

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #232323;">
      <div style="background-color: #026957; padding: 24px; margin-bottom: 24px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Forest River Developer Portal</h1>
      </div>
      
      <h2 style="color: #232323;">Update on Your API Access Request</h2>
      
      <p>Hi ${companyName},</p>
      
      <p>Thank you for your interest in the Forest River API. Unfortunately, your request for <strong>${planName} Plan</strong> access was not approved at this time.</p>
      
      <p>This may be due to incomplete information or eligibility requirements. If you believe this was an error or would like to discuss your request, please contact your Forest River integration representative.</p>
      
      <p>You are welcome to submit a new request through the developer portal.</p>
      
      <p>
        <a href="${portalUrl}/subscribe" style="display: inline-block; background-color: #026957; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold;">View Plans</a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #e2e2e2; margin: 24px 0;" />
      <p style="font-size: 12px; color: #666666;">
        Forest River Developer Portal · <a href="${portalUrl}" style="color: #026957;">portal.forest-river-demo.us</a>
      </p>
    </body>
    </html>
  `;

  const { ok } = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Forest River API <onboarding@resend.dev>",
      to: [toEmail],
      subject: `Update on Your ${planName} API Access Request`,
      html,
    }),
  });

  if (ok) {
    context.log.info(`Rejection email sent to ${toEmail}`);
  } else {
    context.log.warn(`Failed to send rejection email to ${toEmail}`);
  }
}



// ─── Turnstile verification ───────────────────────────────────────────────────

async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = environment.TURNSTILE_SECRET;

  // If no secret configured, skip in dev (log a warning)
  if (!secret) {
    console.warn("TURNSTILE_SECRET not set — skipping bot protection check");
    return true;
  }

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });

    const data = await res.json() as { success: boolean; "error-codes"?: string[] };
    return data.success === true;
  } catch {
    return false;
  }
}

// ─── Auth0 userinfo helper ────────────────────────────────────────────────────

async function getUserEmail(request: ZuploRequest): Promise<string> {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    if (!token) return "";
    const res = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return "";
    const profile = await res.json() as { email?: string };
    return profile.email ?? "";
  } catch { return ""; }
}

// ─── Zuplo management API helpers ────────────────────────────────────────────

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

  const body = await request.json() as {
    planId: string; planName: string;
    companyName?: string; dealerId?: string; useCase?: string;
    expectedVolume?: string; webhookUrl?: string;
    tosAccepted?: boolean; tosAcceptedAt?: string;
    turnstileToken?: string;
  };

  // ── Validate Turnstile token before doing anything else ──
  if (body.turnstileToken) {
    const ip = request.headers.get("CF-Connecting-IP") ?? undefined;
    const valid = await verifyTurnstile(body.turnstileToken, ip);
    if (!valid) {
      context.log.warn("Turnstile verification failed", { ip });
      return new Response(
        JSON.stringify({ error: "Bot protection challenge failed. Please try again." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const userId = request.user.sub!;
  const userEmail = await getUserEmail(request);
  const consumerName = subToConsumerName(userId, body.planId);

  // Check if consumer already exists
  try {
    const existing = await getConsumerWithKey(consumerName);
    const apiKey = existing.tags?.["status"] === "active" ? existing.apiKeys?.[0]?.key : undefined;
    return new Response(JSON.stringify(consumerToSubscription(existing, apiKey)), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch { /* Consumer doesn't exist yet — create it */ }

  const isBasic = body.planId === "basic";

  const consumer = await zuploPost(`/consumers`, {
    name: consumerName,
    description: `${body.companyName || userEmail} — ${body.planName} plan`,
    tags: { plan: body.planId, status: isBasic ? "active" : "pending" },
    metadata: {
      userId, email: userEmail,
      planName: body.planName,
      companyName: body.companyName ?? "",
      dealerId: body.dealerId ?? "",
      useCase: body.useCase ?? "",
      expectedVolume: body.expectedVolume ?? "",
      webhookUrl: body.webhookUrl ?? "",
      tosAccepted: body.tosAccepted ? "true" : "false",
      tosAcceptedAt: body.tosAcceptedAt ?? "",
      requestedAt: new Date().toISOString(),
      ...(isBasic ? { resolvedAt: new Date().toISOString() } : {}),
    },
  }) as ZuploConsumer;

  let apiKey: string | undefined;
  if (isBasic) {
    const keyData = await zuploPost(`/consumers/${consumerName}/keys`, {
      description: `${body.planId} key for ${userEmail}`,
    }) as { key: string };
    apiKey = keyData.key;
  }

  return new Response(JSON.stringify(consumerToSubscription(consumer, apiKey)), {
    status: 201, headers: { "Content-Type": "application/json" },
  });
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
  return new Response(JSON.stringify(consumers.map(c => consumerToSubscription(c))), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}

/** POST /admin/subscriptions/:id/approve */
export async function adminApproveSubscription(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const consumerName = request.params.id;
  const existing = await getConsumerWithKey(consumerName);

  const keyData = await zuploPost(`/consumers/${consumerName}/keys`, {
    description: "Approved subscription key",
  }) as { key: string };

  const updated = await zuploPatch(`/consumers/${consumerName}`, {
    tags: { ...existing.tags, status: "active" },
    metadata: { ...existing.metadata, resolvedAt: new Date().toISOString() },
  }) as ZuploConsumer;


  // Send approval email in background — does not block response
  context.waitUntil(sendApprovalEmail(
    existing.metadata?.["email"] ?? "",
    existing.metadata?.["companyName"] || existing.metadata?.["email"] || "Dealer",
    existing.metadata?.["planName"] ?? "API",
    keyData.key,
    context
  ));

  return new Response(JSON.stringify(consumerToSubscription(updated, keyData.key)), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
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


  // Send rejection email in background — does not block response
  context.waitUntil(sendRejectionEmail(
    existing.metadata?.["email"] ?? "",
    existing.metadata?.["companyName"] || existing.metadata?.["email"] || "Dealer",
    existing.metadata?.["planName"] ?? "API",
    context
  ));

  return new Response(JSON.stringify(consumerToSubscription(updated)), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}

/** POST /admin/subscriptions/:id/move — move consumer to a different plan group */
export async function adminMoveSubscription(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const consumerName = request.params.id;
  const body = await request.json() as { planId: string; planName?: string };
  const { planId, planName } = body;

  const existing = await getConsumerWithKey(consumerName);

  // Update the plan tag — this changes the rate limit group immediately
  const updated = await zuploPatch(`/consumers/${consumerName}`, {
    tags: { ...existing.tags, plan: planId },
    metadata: {
      ...existing.metadata,
      planName: planName ?? planId,
      movedAt: new Date().toISOString(),
    },
  }) as ZuploConsumer;

  context.log.info(`Consumer ${consumerName} moved to plan group: ${planId}`);

  return new Response(JSON.stringify(consumerToSubscription(updated)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}