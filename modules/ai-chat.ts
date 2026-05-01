import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const ZUPLO_ACCOUNT = "lavender-outstanding-bear";
const BASE = `https://dev.zuplo.com/v1/accounts/${ZUPLO_ACCOUNT}/key-buckets`;
const MCP_SERVER_BASE = "https://forest-river-demo-main-fb06bf1.zuplo.app/mcp";

async function zuploGet(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${environment.API_KEY}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Zuplo API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getDealerApiKey(userId: string, context: ZuploContext): Promise<string | undefined> {
  // List all consumers and filter by userId in metadata — same pattern as getMySubscriptions
  const all = await zuploGet("/consumers?limit=1000");
  const consumers: any[] = all.data ?? [];
  context.log.info(`ai-chat: ${consumers.length} total consumers, searching for userId=${userId}`);

  const mine = consumers.filter(
    (c) => c.metadata?.["userId"] === userId && c.tags?.["status"] === "active"
  );
  context.log.info(`ai-chat: ${mine.length} active consumers found for this user`);

  for (const c of mine) {
    try {
      const withKey = await zuploGet(`/consumers/${c.name}?include-api-keys=true&key-format=visible`);
      const key = withKey.apiKeys?.[0]?.key;
      if (key) {
        context.log.info(`ai-chat: using key from consumer ${c.name}`);
        return key;
      }
    } catch (err) {
      context.log.debug(`ai-chat: failed to get key for consumer ${c.name}: ${err}`);
    }
  }
  return undefined;
}

export async function aiChatHandler(request: ZuploRequest, context: ZuploContext) {
  const openaiKey = environment.OPENAI_API_KEY;
  if (!openaiKey) {
    return new Response(JSON.stringify({ error: "OpenAI key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = request.user?.sub as string | undefined;
  context.log.info(`ai-chat: request from userId=${userId ?? "none"}`);

  let mcpApiKey: string | undefined;
  if (userId) {
    mcpApiKey = await getDealerApiKey(userId, context);
  }

  if (!mcpApiKey) {
    context.log.warn(`ai-chat: no active subscription key found for userId=${userId}`);
    return new Response(
      JSON.stringify({ error: "no_subscription", message: "No active API subscription. Go to Plans to subscribe." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await request.json();

  const openaiBody = {
    ...body,
    tools: [
      {
        type: "mcp",
        server_label: "forest-river-api",
        server_description: "Forest River Dealer API — vehicles, inventory, pricing, dealers, orders",
        server_url: `${MCP_SERVER_BASE}?apiKey=${mcpApiKey}`,
        require_approval: "never",
        allowed_tools: ["list_vehicles", "get_inventory", "list_dealers", "get_pricing", "list_orders", "get_order"],
      },
    ],
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify(openaiBody),
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
