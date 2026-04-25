/**
 * modules/admin-auth.ts
 *
 * Restricts admin routes to users with the "api-admin" role in their JWT.
 * Role is added via an Auth0 Post Login Action.
 */

import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function adminAuth(
  request: ZuploRequest,
  context: ZuploContext,
  options: never,
  policyName: string
) {
  const user = request.user;

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = user.data as any;
  const roles: string[] = data?.roles ?? data?.["https://forest-river-demo/roles"] ?? [];

  if (!roles.includes("api-admin")) {
    return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return request;
}