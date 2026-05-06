import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function handler(response: Response, request: ZuploRequest, context: ZuploContext) {
  const limit = parseInt(response.headers.get("x-ratelimit-limit") ?? "0", 10);
  const remaining = parseInt(response.headers.get("x-ratelimit-remaining") ?? "0", 10);
  const reset = parseInt(response.headers.get("x-ratelimit-reset") ?? "0", 10);
  return new Response(JSON.stringify({ limit, remaining, reset }), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
