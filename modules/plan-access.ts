import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const PORTAL_URL = "https://forest-river-demo-main-fb06bf1.zuplo.site";
const BASE = `https://dev.zuplo.com/v1/accounts/lavender-outstanding-bear/key-buckets`;

export default async function policy(
  request: ZuploRequest,
  context: ZuploContext,
  options: { allowedPlans: string[] }
) {
  const user = request.user;
  if (!user) return request;

  // Live fetch to bypass Zuplo's API key cache for plan checks
  let plan = (user.data as any)?.plan ?? "catalog";
  try {
    const url = `${BASE}/${environment.BUCKET_NAME}/consumers/${user.sub}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${environment.API_KEY}`, "Content-Type": "application/json" },
    });
    if (res.ok) {
      const data = await res.json() as { tags?: Record<string, string> };
      plan = data.tags?.["plan"] ?? plan;
    }
  } catch (err) {
    context.log.warn(`[plan-access] live fetch failed: ${err}`);
  }

  if (options.allowedPlans.includes(plan)) return request;
  return new Response(JSON.stringify({
    type: "https://httpproblems.com/http-status/403",
    title: "Forbidden",
    status: 403,
    detail: `Your ${plan} plan does not include access to this API. Upgrade at ${PORTAL_URL}/subscribe.`,
  }), { status: 403, headers: { "Content-Type": "application/json" } });
}
