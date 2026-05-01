import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const ZUPLO_ACCOUNT = "lavender-outstanding-bear";
const BASE = `https://dev.zuplo.com/v1/accounts/${ZUPLO_ACCOUNT}/key-buckets`;
const MCP_SERVER_BASE = "https://forest-river-demo-main-fb06bf1.zuplo.app/mcp";
const PLANS = ["basic", "pro", "enterprise"];

function subToConsumerName(sub: string, planId: string): string {
  return `${sub.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 100)}-${planId}`;
}

async function zuploGet(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${environment.API_KEY}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Zuplo API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getDealerApiKey(userId: string, context: ZuploContext): Promise<string | undefined> {
  for (const planId of PLANS) {
    const name = subToConsumerName(userId, planId);
    try {
      const consumer = await zuploGet(`/consumers/${name}?include-api-keys=true&key-format=visible`);
      const status = consumer.tags?.["status"];
      const key = consumer.apiKeys?.[0]?.key;
      context.log.info(`ai-chat: consumer=${name} status=${status} hasKey=${!!key}`);
      if (status === "active" && key) return key;
    } catch (err) {
      context.log.debug(`ai-chat: no consumer ${name}: ${err}`);
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
