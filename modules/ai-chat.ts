import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const API_BASE = "https://forest-river-demo-main-fb06bf1.zuplo.app";

const TOOLS = [
  {
    type: "function",
    name: "list_vehicles",
    description: "List Forest River vehicles from the product catalog. Filter by category, type, or year.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["Camping", "Work & Play", "Marine", "Specialty"] },
        type: { type: "string", description: "Vehicle type e.g. travel-trailer, fifth-wheel, class-a-motorhome" },
        year: { type: "integer" },
      },
    },
  },
  {
    type: "function",
    name: "get_inventory",
    description: "Get dealer inventory including on-lot, in-transit, and on-order units with pricing and days on lot.",
    parameters: {
      type: "object",
      properties: {
        dealerId: { type: "string" },
        status: { type: "string", enum: ["on-lot", "in-transit", "on-order", "sold"] },
        category: { type: "string", enum: ["Camping", "Work & Play", "Marine", "Specialty"] },
      },
    },
  },
  {
    type: "function",
    name: "list_dealers",
    description: "List authorized Forest River dealers. Filter by US state.",
    parameters: {
      type: "object",
      properties: {
        state: { type: "string", description: "Two-letter US state code e.g. IN, TX, FL" },
        category: { type: "string" },
      },
    },
  },
  {
    type: "function",
    name: "get_pricing",
    description: "Get MSRP and dealer net pricing for vehicles.",
    parameters: {
      type: "object",
      properties: {
        sku: { type: "string" },
        year: { type: "integer" },
      },
    },
  },
  {
    type: "function",
    name: "list_orders",
    description: "List all orders for this dealer account.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "confirmed", "in-production", "shipped", "delivered", "cancelled"] },
      },
    },
  },
  {
    type: "function",
    name: "get_order",
    description: "Get full details and status history for a specific order.",
    parameters: {
      type: "object",
      required: ["orderId"],
      properties: {
        orderId: { type: "string" },
      },
    },
  },
];

function buildParams(args: Record<string, any>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(args)) {
    if (v !== undefined && v !== null && k !== "orderId") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function callTool(name: string, args: Record<string, any>, dealerKey: string): Promise<string> {
  const headers = { Authorization: `Bearer ${dealerKey}` };
  let url: string;
  switch (name) {
    case "list_vehicles": url = `${API_BASE}/v2/vehicles${buildParams(args)}`; break;
    case "get_inventory": url = `${API_BASE}/v2/inventory${buildParams(args)}`; break;
    case "list_dealers":  url = `${API_BASE}/v2/dealers${buildParams(args)}`; break;
    case "get_pricing":   url = `${API_BASE}/v2/pricing${buildParams(args)}`; break;
    case "list_orders":   url = `${API_BASE}/v2/orders${buildParams(args)}`; break;
    case "get_order":     url = `${API_BASE}/v2/orders/${args.orderId}`; break;
    default: return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
  try {
    const res = await fetch(url, { headers });
    return await res.text();
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

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
  let openaiBody: any = { ...rest, tools: TOOLS };
  const calledTools: { type: string; name: string }[] = [];

  for (let i = 0; i < 6; i++) {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify(openaiBody),
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fnCalls = (data.output ?? []).filter((o: any) => o.type === "function_call");
    if (fnCalls.length === 0) {
      const enriched = { ...data, output: [...calledTools, ...(data.output ?? [])] };
      return new Response(JSON.stringify(enriched), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const toolOutputs = await Promise.all(
      fnCalls.map(async (call: any) => {
        calledTools.push({ type: "function_call", name: call.name });
        const args = JSON.parse(call.arguments || "{}");
        const result = await callTool(call.name, args, dealerKey);
        return { type: "function_call_output", call_id: call.id, output: result };
      })
    );

    openaiBody = {
      ...openaiBody,
      input: [
        ...(Array.isArray(openaiBody.input) ? openaiBody.input : []),
        ...(data.output ?? []),
        ...toolOutputs,
      ],
    };
  }

  const finalRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify(openaiBody),
  });
  const finalData = await finalRes.json();
  return new Response(JSON.stringify(finalData), {
    status: finalRes.status,
    headers: { "Content-Type": "application/json" },
  });
}
