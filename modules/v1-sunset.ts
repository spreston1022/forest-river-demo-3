/**
 * modules/v1-sunset.ts
 *
 * Inbound policy that permanently shuts down v1 after the sunset date.
 * Returns 410 Gone with a migration message.
 *
 * The two-phase approach used in production:
 *   Phase 1 (now → May 23): Brownout policy creates scheduled disruptions
 *                            to pressure dealers to migrate
 *   Phase 2 (May 30 onward): This policy permanently returns 410 Gone
 */

import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

const SUNSET_DATE = new Date("2026-05-30T00:00:00Z");

export default async function v1Sunset(
  request: ZuploRequest,
  context: ZuploContext,
  options: never,
  policyName: string,
): Promise<Response | ZuploRequest> {
  const now = new Date();

  if (now >= SUNSET_DATE) {
    return new Response(
      JSON.stringify({
        type: "https://httpproblems.com/http-status/410",
        title: "Gone",
        status: 410,
        detail:
          "The Forest River API v1 was retired on May 30, 2026. " +
          "Please migrate to v2. See https://forest-river-demo-main-fb06bf1.zuplo.site/api for the v2 reference.",
        instance: request.url,
      }),
      {
        status: 410,
        headers: { "Content-Type": "application/problem+json" },
      }
    );
  }

  // Before sunset date — let the request through
  return request;
}