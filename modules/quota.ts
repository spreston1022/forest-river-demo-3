import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function handler(request: ZuploRequest, context: ZuploContext) {
  const user = request.user;
  const plan = (user?.data as any)?.plan ?? "catalog";
  return new Response(JSON.stringify({ plan }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
