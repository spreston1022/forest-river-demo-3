import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (response: Response, request: ZuploRequest, context: ZuploContext) {
  const headers = new Headers(response.headers);
  headers.set(
    "Access-Control-Expose-Headers",
    "RateLimit-Remaining, RateLimit-Limit, RateLimit-Reset, X-RateLimit-Remaining, X-RateLimit-Limit",
  );
  return new Response(response.body, { status: response.status, headers });
}
