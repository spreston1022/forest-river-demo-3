import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth, useZudoku } from "zudoku/hooks";

const GATEWAY_URL = import.meta.env.ZUPLO_PUBLIC_SERVER_URL ?? "https://forest-river-demo-main-fb06bf1.zuplo.app";

const SYSTEM_PROMPT = `You are a helpful assistant for Forest River, Inc. authorized dealer partners.
You have access to the Forest River Dealer API and can help dealers find vehicle information, check inventory, look up pricing, find other dealers, and manage orders.

When answering questions:
- Always use the available tools to get real data rather than making things up
- Present information clearly and concisely
- For pricing, always mention both MSRP and dealer net price
- For inventory, mention the status (on-lot, in-transit, etc.) and days on lot when relevant
- For vehicles, highlight key specs like length, sleeps, slides, and notable features
- Keep responses brief and scannable — use bullet points where helpful
- You represent Forest River's professional dealer support. Be helpful, accurate, and efficient.`;

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: string[];
  loading?: boolean;
}

const SUGGESTED = [
  "Show me Camping vehicles",
  "Check inventory status",
  "Find dealers in Indiana",
  "Get pricing for Rockwood models",
];

const TOOL_LABELS: Record<string, string> = {
  list_vehicles: "🚐 Searched vehicles",
  get_inventory: "📦 Checked inventory",
  list_dealers: "📍 Found dealers",
  get_pricing: "💰 Retrieved pricing",
  list_orders: "📋 Listed orders",
  get_order: "🔍 Got order details",
};

export function ChatWidget() {
  const auth = useAuth();
  const { authentication } = useZudoku();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dealerKey, setDealerKey] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch the user's active API key from their subscription on mount
  useEffect(() => {
    if (!auth.isAuthenticated || !authentication) return;
    (async () => {
      try {
        const req = new Request(`${GATEWAY_URL}/subscriptions`);
        const signed = await authentication.signRequest(req);
        const res = await fetch(signed);
        if (!res.ok) return;
        const subs: any[] = await res.json();
        const active = subs.find((s) => s.status === "active" && s.apiKey);
        if (active) setDealerKey(active.apiKey);
      } catch {}
    })();
  }, [auth.isAuthenticated, authentication]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg, { role: "assistant", content: "", loading: true }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const history = messages.filter(m => !m.loading).map(m => ({ role: m.role, content: m.content }));

      const req = new Request(`${GATEWAY_URL}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          instructions: SYSTEM_PROMPT,
          dealerKey,
          input: [
            ...history.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: text },
          ],
        }),
      });

      const signed = await authentication?.signRequest(req);
      const res = await fetch(signed ?? req);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? err.error?.message ?? err.title ?? `Error ${res.status}`);
      }

      const data = await res.json();
      const toolCalls: string[] = [];
      let assistantText = data.output_text ?? "";

      for (const item of data.output ?? []) {
        if (item.type === "function_call") toolCalls.push(item.name);
        if (item.type === "message") {
          for (const c of item.content ?? []) {
            if (c.type === "output_text") assistantText += c.text;
          }
        }
      }

      setMessages(prev => [...prev.slice(0, -1), {
        role: "assistant",
        content: assistantText || "I couldn't generate a response. Please try again.",
        toolCalls,
      }]);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [messages, loading, authentication, dealerKey]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  if (!auth.isAuthenticated) return null;

  return createPortal(
    <>
      {open && (
        <div
          className="fixed bottom-20 right-4 z-50 flex flex-col bg-background border rounded-2xl shadow-2xl"
          style={{ width: 360, height: 520 }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b rounded-t-2xl bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">FR</div>
              <div>
                <p className="text-sm font-semibold">AI Assistant</p>
                <p className="text-xs opacity-75">Forest River Dealer Support</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="opacity-75 hover:opacity-100 text-lg leading-none">×</button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center pt-2">
                  {dealerKey
                    ? "Ask me about vehicles, inventory, pricing, dealers, or orders"
                    : "Subscribe to a plan to use the AI assistant"}
                </p>
                {dealerKey && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {SUGGESTED.map(s => (
                      <button key={s} onClick={() => send(s)}
                        className="rounded-lg border bg-card text-xs px-2 py-1.5 text-left hover:bg-muted transition-colors font-medium leading-tight">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%]">
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {msg.toolCalls.map((tc, j) => (
                        <span key={j} className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                          {TOOL_LABELS[tc] ?? `🔧 ${tc}`}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className={`rounded-2xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}>
                    {msg.loading ? (
                      <div className="flex gap-1 items-center h-4">
                        {[0, 150, 300].map(d => (
                          <div key={d} className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">⚠️ {error}</div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 pb-3 pt-2 border-t flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={dealerKey ? "Ask about vehicles, inventory…" : "No active subscription"}
              disabled={loading || !dealerKey}
              className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading || !dealerKey}
              className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              ↑
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center"
        style={{ boxShadow: "0 4px 24px rgba(2, 105, 87, 0.4)" }}
        title="Forest River AI Assistant"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </>,
    document.body
  );
}

export default ChatWidget;
