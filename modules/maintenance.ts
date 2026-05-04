import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const ZUPLO_ACCOUNT = "lavender-outstanding-bear";
const CONFIG_CONSUMER = "__system-config";
const CACHE_TTL_MS = 30_000;

export const ROUTE_KEYS = ["vehicles", "inventory", "orders", "pricing", "dealers", "mcp"] as const;
export type RouteKey = typeof ROUTE_KEYS[number];

export interface RouteKillState {
  enabled: boolean;
  enabledAt?: string;
}

export type KillSwitchState = Record<RouteKey, RouteKillState>;

let tagCache: Record<string, string> = {};
let cacheExpiry = 0;

function baseUrl() {
  return `https://dev.zuplo.com/v1/accounts/${ZUPLO_ACCOUNT}/key-buckets/${environment.BUCKET_NAME}`;
}

function zuploHeaders() {
  return { Authorization: `Bearer ${environment.API_KEY}`, "Content-Type": "application/json" };
}

async function getTags(): Promise<Record<string, string>> {
  if (Date.now() < cacheExpiry) return tagCache;
  try {
    const res = await fetch(`${baseUrl()}/consumers/${CONFIG_CONSUMER}`, { headers: zuploHeaders() });
    if (res.ok) {
      const data = await res.json() as { tags?: Record<string, string> };
      tagCache = data.tags ?? {};
    } else if (res.status === 404) {
      tagCache = {};
    }
  } catch { /* keep cached */ }
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return tagCache;
}

async function patchTags(updates: Record<string, string | undefined>): Promise<Record<string, string>> {
  const current = await getTags();
  const merged: Record<string, string> = { ...current };
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) delete merged[k];
    else merged[k] = v;
  }
  let res = await fetch(`${baseUrl()}/consumers/${CONFIG_CONSUMER}`, {
    method: "PATCH",
    headers: zuploHeaders(),
    body: JSON.stringify({ tags: merged }),
  });
  if (res.status === 404) {
    res = await fetch(`${baseUrl()}/consumers`, {
      method: "POST",
      headers: zuploHeaders(),
      body: JSON.stringify({ name: CONFIG_CONSUMER, description: "System configuration — do not delete", tags: merged }),
    });
  }
  if (!res.ok) throw new Error(`Failed to update system config: ${await res.text()}`);
  tagCache = merged;
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return merged;
}

function tagsToState(tags: Record<string, string>): KillSwitchState {
  return Object.fromEntries(
    ROUTE_KEYS.map(key => [key, {
      enabled: tags[`kill.${key}`] === "true",
      enabledAt: tags[`kill.${key}.at`],
    }])
  ) as KillSwitchState;
}

// ─── Inbound policy (used with options: { routeKey }) ─────────────────────────

export default async function policy(
  request: ZuploRequest,
  context: ZuploContext,
  options: { routeKey: RouteKey }
) {
  const tags = await getTags();
  if (tags[`kill.${options.routeKey}`] !== "true") return request;
  return new Response(JSON.stringify({
    type: "https://httpproblems.com/http-status/503",
    title: "Service Unavailable",
    status: 503,
    detail: `The Forest River ${options.routeKey} API is currently unavailable. Please check the developer portal for updates.`,
  }), { status: 503, headers: { "Content-Type": "application/json", "Retry-After": "300" } });
}

// ─── Admin handlers ───────────────────────────────────────────────────────────

export async function adminGetMaintenance(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const tags = await getTags();
  return new Response(JSON.stringify(tagsToState(tags)), { status: 200, headers: { "Content-Type": "application/json" } });
}

export async function adminSetMaintenance(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const body = await request.json() as { routeKey: RouteKey; enabled: boolean };
  if (!ROUTE_KEYS.includes(body.routeKey)) {
    return new Response(JSON.stringify({ error: "Invalid routeKey" }), { status: 400 });
  }
  const updates: Record<string, string | undefined> = {
    [`kill.${body.routeKey}`]: body.enabled ? "true" : "false",
    [`kill.${body.routeKey}.at`]: body.enabled ? new Date().toISOString() : undefined,
  };
  const merged = await patchTags(updates);
  context.log.warn(`Kill switch [${body.routeKey}] ${body.enabled ? "ENABLED" : "DISABLED"} by ${(request.user as any).email ?? request.user.sub}`);
  return new Response(JSON.stringify(tagsToState(merged)), { status: 200, headers: { "Content-Type": "application/json" } });
}
