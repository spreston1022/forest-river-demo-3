/**
 * modules/rate-limit.ts
 *
 * Dynamic rate limiting based on the consumer's plan.
 * Reads the "plan" tag from the API key consumer metadata
 * and returns the appropriate rate limit for that tier.
 *
 * Plan limits:
 *   basic      — 100 req/min
 *   pro        — 15 req/min  (intentionally low for demo purposes)
 *   enterprise — unlimited (10,000 req/min effectively)
 */

import { ZuploContext, ZuploRequest, CustomRateLimitDetails } from "@zuplo/runtime";

export function rateLimit(
  request: ZuploRequest,
  context: ZuploContext,
  policyName: string,
): CustomRateLimitDetails | undefined {
  const user = request.user;

  if (!user) {
    // No user — let api-key-inbound handle the 401
    return undefined;
  }

  const plan = (user.data as any)?.plan ?? "basic";

  context.log.info(`rate-limit: consumer ${user.sub} on plan "${plan}"`);

  switch (plan) {
    case "enterprise":
      return {
        key: user.sub,
        requestsAllowed: 10000,
        timeWindowMinutes: 1,
      };

    case "pro":
      return {
        key: user.sub,
        requestsAllowed: 15,
        timeWindowMinutes: 1,
      };

    case "basic":
    default:
      return {
        key: user.sub,
        requestsAllowed: 100,
        timeWindowMinutes: 1,
      };
  }
}