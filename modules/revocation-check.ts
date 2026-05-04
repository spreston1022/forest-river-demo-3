import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const ZUPLO_ACCOUNT = "lavender-outstanding-bear";
const BASE = `https://dev.zuplo.com/v1/accounts/${ZUPLO_ACCOUNT}/key-buckets`;

function zuploHeaders() {
  return { Authorization: `Bearer ${environment.API_KEY}`, "Content-Type": "application/json" };
}

export default async function(request: ZuploRequest, context: ZuploContext) {
  const user = request.user;
  if (!user) return request;

  const tags = (user.data as any) ?? {};
  const status = tags["status"];
  const oldKeyId = tags["oldKeyId"] ?? "";
  const oldKeyExpiry = tags["oldKeyExpiry"] ?? "";
  const consumerName = user.sub ?? "";
  const bucket = environment.BUCKET_NAME;

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
          body: JSON.stringify({ tags: { ...tags, oldKeyId: "", oldKeyExpiry: "" } }),
        });
      } catch (err) {
        context.log.warn("Lazy cleanup failed for consumer " + consumerName + ": " + err);
      }
    })());
  }

  return request;
}
