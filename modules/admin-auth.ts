/**
 * modules/admin-auth.ts
 *
 * Restricts admin routes to sam@zuplo.com.
 * Checks multiple claim locations since Auth0 may place email differently.
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

  // Log all user data to help debug claim location
  context.log.info("admin-auth user.sub", user.sub);
  context.log.info("admin-auth user.data", JSON.stringify(user.data));

  const data = user.data as any;

  // Auth0 may place email in different locations depending on configuration
  const email =
    data?.email ||
    data?.["https://forest-river-demo/email"] ||
    data?.["email"] ||
    null;

  context.log.info("admin-auth resolved email", email);

  if (email !== ADMIN_EMAIL) {
    return new Response(
      JSON.stringify({
        error: "Forbidden — admin only",
        debug: { sub: user.sub, email, data },
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return request;
}