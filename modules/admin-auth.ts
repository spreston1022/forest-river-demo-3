/**
 * modules/admin-auth.ts
 *
 * Restricts admin routes to the configured admin user.
 * Uses sub (Auth0 user ID) instead of email since email
 * is not included in the access token by default.
 *
 * To find your sub: check the Zuplo logs after any authenticated
 * request — it appears as user.sub in the JWT.
 */

import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

// sam@zuplo.com's Auth0 sub — from the JWT logs
const ADMIN_SUB = "auth0|69e72c26c61be620e134af9b";

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

  if (user.sub !== ADMIN_SUB) {
    return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return request;
}