import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const ZUPLO_ACCOUNT = "lavender-outstanding-bear";
const BASE = `https://dev.zuplo.com/v1/accounts/${ZUPLO_ACCOUNT}/key-buckets`;

function zuploHeaders() {
  return { Authorization: `Bearer ${environment.API_KEY}`, "Content-Type": "application/json" };
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "2026-05"
}

async function incrementUsage(consumerName: string) {
  try {
    const res = await fetch(`${BASE}/${environment.BUCKET_NAME}/consumers/${consumerName}`, {
      headers: zuploHeaders(),
    });
    if (!res.ok) return;
    const data = await res.json() as { metadata?: Record<string, string> };
    const meta = data.metadata ?? {};
    const month = currentMonth();
    const count = meta["requestCountMonth"] === month ? parseInt(meta["requestCount"] ?? "0") + 1 : 1;
    await fetch(`${BASE}/${environment.BUCKET_NAME}/consumers/${consumerName}`, {
      method: "PATCH",
      headers: zuploHeaders(),
      body: JSON.stringify({ metadata: { ...meta, requestCount: String(count), requestCountMonth: month } }),
    });
  } catch { /* non-critical */ }
}

export default async function (response: Response, request: ZuploRequest, context: ZuploContext) {
  const headers = new Headers(response.headers);
  headers.set(
    "Access-Control-Expose-Headers",
    "RateLimit-Remaining, RateLimit-Limit, RateLimit-Reset, X-RateLimit-Remaining, X-RateLimit-Limit",
  );

  if (request.user?.sub) {
    context.waitUntil(incrementUsage(request.user.sub));
  }

  return new Response(response.body, { status: response.status, headers });
}
