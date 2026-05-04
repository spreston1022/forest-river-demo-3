import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const ZUPLO_ACCOUNT = "lavender-outstanding-bear";
const CONFIG_CONSUMER = "__system-config";
const CACHE_TTL_MS = 30_000;

export interface MaintenanceState {
  enabled: boolean;
  message: string;
  enabledAt?: string;
}

let cache: MaintenanceState = { enabled: false, message: "" };
let cacheExpiry = 0;

function baseUrl() {
  return `https://dev.zuplo.com/v1/accounts/${ZUPLO_ACCOUNT}/key-buckets/${environment.BUCKET_NAME}`;
}

function zuploHeaders() {
  return { Authorization: `Bearer ${environment.API_KEY}`, "Content-Type": "application/json" };
}

async function fetchState(): Promise<MaintenanceState> {
  if (Date.now() < cacheExpiry) return cache;
  try {
    const res = await fetch(`${baseUrl()}/consumers/${CONFIG_CONSUMER}`, { headers: zuploHeaders() });
    if (res.status === 404) {
      cache = { enabled: false, message: "" };
    } else if (res.ok) {
      const data = await res.json() as { tags?: Record<string, string> };
      cache = {
        enabled: data.tags?.["maintenanceMode"] === "true",
        message: data.tags?.["maintenanceMessage"] ?? "",
        enabledAt: data.tags?.["maintenanceEnabledAt"],
      };
    }
  } catch { /* keep cached value */ }
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return cache;
}

async function writeState(state: MaintenanceState): Promise<void> {
  const tags: Record<string, string> = {
    maintenanceMode: state.enabled ? "true" : "false",
    maintenanceMessage: state.message,
  };
  if (state.enabledAt) tags.maintenanceEnabledAt = state.enabledAt;

  let res = await fetch(`${baseUrl()}/consumers/${CONFIG_CONSUMER}`, {
    method: "PATCH",
    headers: zuploHeaders(),
    body: JSON.stringify({ tags }),
  });
  if (res.status === 404) {
    res = await fetch(`${baseUrl()}/consumers`, {
      method: "POST",
      headers: zuploHeaders(),
      body: JSON.stringify({ name: CONFIG_CONSUMER, description: "System configuration — do not delete", tags }),
    });
  }
  if (!res.ok) throw new Error(`Failed to write maintenance state: ${await res.text()}`);
  cache = state;
  cacheExpiry = Date.now() + CACHE_TTL_MS;
}

// ─── Inbound policy ───────────────────────────────────────────────────────────

export default async function policy(request: ZuploRequest, context: ZuploContext) {
  const state = await fetchState();
  if (!state.enabled) return request;
  const detail = state.message || "The Forest River API is currently undergoing scheduled maintenance. Please try again later or check the developer portal for updates.";
  return new Response(JSON.stringify({
    type: "https://httpproblems.com/http-status/503",
    title: "Service Unavailable — Maintenance",
    status: 503,
    detail,
  }), { status: 503, headers: { "Content-Type": "application/json", "Retry-After": "300" } });
}

// ─── Admin handlers ───────────────────────────────────────────────────────────

export async function adminGetMaintenance(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const state = await fetchState();
  return new Response(JSON.stringify(state), { status: 200, headers: { "Content-Type": "application/json" } });
}

export async function adminSetMaintenance(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const body = await request.json() as { enabled: boolean; message?: string };
  const state: MaintenanceState = {
    enabled: body.enabled,
    message: body.message ?? "",
    enabledAt: body.enabled ? new Date().toISOString() : undefined,
  };
  await writeState(state);
  context.log.warn(`Maintenance mode ${state.enabled ? "ENABLED" : "DISABLED"} by ${(request.user as any).email ?? request.user.sub}`);
  return new Response(JSON.stringify(state), { status: 200, headers: { "Content-Type": "application/json" } });
}
