import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const ZUPLO_ACCOUNT = "lavender-outstanding-bear";
const BASE = `https://dev.zuplo.com/v1/accounts/${ZUPLO_ACCOUNT}/key-buckets`;

function zuploHeaders() {
  return { Authorization: `Bearer ${environment.API_KEY}`, "Content-Type": "application/json" };
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "2026-05"
}

async function incrementUsage(consumerName: string, context: ZuploContext) {
  try {
    const url = `${BASE}/${environment.BUCKET_NAME}/consumers/${consumerName}`;
    context.log.info(`[usage] fetching consumer: ${url}`);
    const res = await fetch(url, { headers: zuploHeaders() });
    context.log.info(`[usage] GET consumer status: ${res.status}`);
    if (!res.ok) {
      context.log.warn(`[usage] GET failed: ${await res.text()}`);
      return;
    }
    const data = await res.json() as { metadata?: Record<string, string> };
    const meta = data.metadata ?? {};
    const month = currentMonth();
    const count = meta["requestCountMonth"] === month ? parseInt(meta["requestCount"] ?? "0") + 1 : 1;
    context.log.info(`[usage] incrementing to ${count} for month ${month}`);
    const patchRes = await fetch(url, {
      method: "PATCH",
      headers: zuploHeaders(),
      body: JSON.stringify({ metadata: { ...meta, requestCount: String(count), requestCountMonth: month } }),
    });
    context.log.info(`[usage] PATCH status: ${patchRes.status}`);
    if (!patchRes.ok) context.log.warn(`[usage] PATCH failed: ${await patchRes.text()}`);
  } catch (err) {
    context.log.error(`[usage] error: ${err}`);
  }
}

export default async function (response: Response, request: ZuploRequest, context: ZuploContext) {
  const headers = new Headers(response.headers);
  headers.set(
    "Access-Control-Expose-Headers",
    "RateLimit-Remaining, RateLimit-Limit, RateLimit-Reset, X-RateLimit-Remaining, X-RateLimit-Limit",
  );

  if (request.user?.sub) {
    context.log.info(`[usage] scheduling increment for consumer: ${request.user.sub}`);
    context.waitUntil(incrementUsage(request.user.sub, context));
  } else {
    context.log.warn(`[usage] no user sub on request`);
  }

  return new Response(response.body, { status: response.status, headers });
}
