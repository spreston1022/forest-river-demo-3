import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const ZUPLO_ACCOUNT = "lavender-outstanding-bear";
const BASE = `https://dev.zuplo.com/v1/accounts/${ZUPLO_ACCOUNT}/key-buckets`;

function zuploHeaders() {
  return { Authorization: `Bearer ${environment.API_KEY}`, "Content-Type": "application/json" };
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

async function incrementUsage(consumerName: string, context: ZuploContext) {
  try {
    const url = `${BASE}/${environment.BUCKET_NAME}/consumers/${consumerName}`;
    const res = await fetch(url, { headers: zuploHeaders() });
    if (!res.ok) { context.log.warn(`[usage] GET failed: ${res.status}`); return; }
    const data = await res.json() as { metadata?: Record<string, string> };
    const meta = data.metadata ?? {};
    const month = currentMonth();
    const count = meta["requestCountMonth"] === month ? parseInt(meta["requestCount"] ?? "0") + 1 : 1;
    context.log.info(`[usage] incrementing ${consumerName} to ${count}`);
    const patchRes = await fetch(url, {
      method: "PATCH",
      headers: zuploHeaders(),
      body: JSON.stringify({ metadata: { ...meta, requestCount: String(count), requestCountMonth: month } }),
    });
    if (!patchRes.ok) context.log.warn(`[usage] PATCH failed: ${await patchRes.text()}`);
  } catch (err) {
    context.log.error(`[usage] error: ${err}`);
  }
}

export default async function(request: ZuploRequest, context: ZuploContext) {
  const user = request.user;
  if (!user) return request;

  const consumerName = user.sub ?? "";
  const bucket = environment.BUCKET_NAME;

  // Live fetch to bypass Zuplo's API key cache for suspension checks
  let liveTags: Record<string, string> = {};
  try {
    const url = `${BASE}/${bucket}/consumers/${consumerName}`;
    const res = await fetch(url, { headers: zuploHeaders() });
    if (res.ok) {
      const data = await res.json() as { tags?: Record<string, string>; metadata?: Record<string, string> };
      liveTags = data.tags ?? {};
    }
  } catch (err) {
    context.log.warn(`[revocation] live fetch failed: ${err}`);
  }

  context.log.info(`[revocation] liveTags: ${JSON.stringify(liveTags)}`);

  const status = liveTags["status"];
  const oldKeyId = liveTags["oldKeyId"] ?? "";
  const oldKeyExpiry = liveTags["oldKeyExpiry"] ?? "";

  if (status === "suspended") {
    return new Response(
      JSON.stringify({
        type: "https://httpproblems.com/http-status/403",
        title: "Forbidden",
        status: 403,
        detail: "Your API access has been suspended. Contact your Forest River representative.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (oldKeyId && oldKeyExpiry && new Date(oldKeyExpiry) < new Date()) {
    context.waitUntil((async () => {
      try {
        await fetch(`${BASE}/${bucket}/consumers/${consumerName}/keys/${oldKeyId}`, {
          method: "DELETE",
          headers: zuploHeaders(),
        });
        await fetch(`${BASE}/${bucket}/consumers/${consumerName}`, {
          method: "PATCH",
          headers: zuploHeaders(),
          body: JSON.stringify({ tags: { ...liveTags, oldKeyId: "", oldKeyExpiry: "" }, metadata: { oldKeyValue: "" } }),
        });
      } catch (err) {
        context.log.warn("Lazy cleanup failed for consumer " + consumerName + ": " + err);
      }
    })());
  }

  context.waitUntil(incrementUsage(consumerName, context));

  return request;
}
