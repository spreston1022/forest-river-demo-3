import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

const PLAN_LIMITS: Record<string, { requestsAllowed: number; timeWindowMinutes: number }> = {
  catalog:    { requestsAllowed: 10,    timeWindowMinutes: 1 },
  commerce:   { requestsAllowed: 10,    timeWindowMinutes: 1 },
  basic:      { requestsAllowed: 10,    timeWindowMinutes: 1 },
  pro:        { requestsAllowed: 50,    timeWindowMinutes: 1 },
  enterprise: { requestsAllowed: 10000, timeWindowMinutes: 1 },
};

export default async function handler(request: ZuploRequest, context: ZuploContext) {
  const user = request.user;
  const plan = (user?.data as any)?.plan ?? "catalog";
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.catalog;
  return new Response(JSON.stringify({ plan, ...limits }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
