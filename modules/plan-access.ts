import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

const PORTAL_URL = "https://forest-river-demo-main-fb06bf1.zuplo.site";

export default async function policy(
  request: ZuploRequest,
  context: ZuploContext,
  options: { allowedPlans: string[] }
) {
  const user = request.user;
  if (!user) return request;
  const plan = (user.data as any)?.plan ?? "catalog";
  if (options.allowedPlans.includes(plan)) return request;
  return new Response(JSON.stringify({
    type: "https://httpproblems.com/http-status/403",
    title: "Forbidden",
    status: 403,
    detail: `Your ${plan} plan does not include access to this API. Upgrade at ${PORTAL_URL}/subscribe.`,
  }), { status: 403, headers: { "Content-Type": "application/json" } });
}
