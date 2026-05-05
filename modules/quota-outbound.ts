import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function handler(response: Response, request: ZuploRequest, context: ZuploContext) {
  const limit = parseInt(response.headers.get("x-ratelimit-limit") ?? "0", 10);
  const remaining = parseInt(response.headers.get("x-ratelimit-remaining") ?? "0", 10);
  const reset = parseInt(response.headers.get("x-ratelimit-reset") ?? "60", 10);
  const body = await response.json() as Record<string, unknown>;
  return new Response(JSON.stringify({ ...body, limit, remaining, reset }), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
