import { ZuploContext, ZuploRequest, CustomRateLimitDetails } from "@zuplo/runtime";

export function quota(
  request: ZuploRequest,
  context: ZuploContext,
  policyName: string,
): CustomRateLimitDetails | undefined {
  const user = request.user;
  if (!user) return undefined;

  const plan = (user.data as any)?.plan ?? "catalog";
  const MONTH = 43200; // 30 days in minutes

  context.log.info(`quota: consumer ${user.sub} on plan "${plan}"`);

  switch (plan) {
    case "enterprise":
      return { key: user.sub, requestsAllowed: 50_000_000, timeWindowMinutes: MONTH };
    case "pro":
      return { key: user.sub, requestsAllowed: 5_000_000, timeWindowMinutes: MONTH };
    case "catalog":
    case "commerce":
    case "basic":
    default:
      return { key: user.sub, requestsAllowed: 500_000, timeWindowMinutes: MONTH };
  }
}
