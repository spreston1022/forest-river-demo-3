import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

function getHeader(response: Response, ...names: string[]): string | null {
  for (const name of names) {
    const val = response.headers.get(name);
    if (val !== null) return val;
  }
  return null;
}

export default async function handler(response: Response, request: ZuploRequest, context: ZuploContext) {
  const allHeaders: Record<string, string> = {};
  response.headers.forEach((v, k) => { allHeaders[k] = v; });
  context.log.info("quota-outbound headers: " + JSON.stringify(allHeaders));

  const limit = parseInt(getHeader(response, "x-ratelimit-limit", "ratelimit-limit") ?? "0", 10);
  const remaining = parseInt(getHeader(response, "x-ratelimit-remaining", "ratelimit-remaining") ?? "0", 10);
  const reset = parseInt(getHeader(response, "x-ratelimit-reset", "ratelimit-reset") ?? "0", 10);

  return new Response(JSON.stringify({ limit, remaining, reset, _headers: allHeaders }), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
