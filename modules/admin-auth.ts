/**
 * modules/admin-auth.ts
 *
 * Inbound policy that restricts access to admin routes.
 * Only allows requests from the configured admin email.
 */

import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

const ADMIN_EMAIL = "sam@zuplo.com";

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

  const email = (user.data as any)?.email;
  if (email !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return request;
}
