import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const MCP_SERVER_BASE = "https://forest-river-demo-main-fb06bf1.zuplo.app/mcp";

export async function aiChatHandler(request: ZuploRequest, context: ZuploContext) {
  const openaiKey = environment.OPENAI_API_KEY;
  if (!openaiKey) {
    return new Response(JSON.stringify({ error: "OpenAI key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const dealerKey: string | undefined = body.dealerKey;

  if (!dealerKey) {
    return new Response(
      JSON.stringify({ message: "No active API subscription. Go to Plans to subscribe." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const { dealerKey: _removed, ...rest } = body;

  const openaiBody = {
    ...rest,
    tools: [
      {
        type: "mcp",
        server_label: "forest-river-api",
        server_description: "Forest River Dealer API — vehicles, inventory, pricing, dealers, orders",
        server_url: `${MCP_SERVER_BASE}?apiKey=${dealerKey}`,
        require_approval: "never",
        allowed_tools: ["v2-list-vehicles", "v2-get-inventory", "v2-list-dealers", "v2-get-pricing", "v2-list-orders", "v2-get-order"],
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
