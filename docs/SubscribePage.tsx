import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth, useZudoku } from "zudoku/hooks";

const GATEWAY_URL = import.meta.env.ZUPLO_PUBLIC_SERVER_URL ?? "https://forest-river-demo-main-fb06bf1.zuplo.app";

// Replace with your actual Turnstile sitekey from dash.cloudflare.com/turnstile
// For testing use: 1x00000000000000000000AA (always passes)
const TURNSTILE_SITEKEY = import.meta.env.ZUDOKU_PUBLIC_TURNSTILE_SITEKEY ?? "1x00000000000000000000AA";

interface Plan {
  id: "catalog" | "commerce" | "pro" | "enterprise";
  name: string;
  tier: "free" | "paid";
  approval: "auto" | "manual";
  price: string;
  rateLimit: string;
  monthlyQuota: string;
  sla: string;
  apis: string[];
  highlighted?: boolean;
  description: string;
}

interface Subscription {
  id: string;
  planId: "catalog" | "commerce" | "pro" | "enterprise" | string;
  planName: string;
  status: "pending" | "active" | "rejected" | "suspended" | "approved_pending_payment";
  apiKey?: string;
  oldKey?: string;
  oldKeyExpiry?: string;
  requestedAt: string;
  resolvedAt?: string;
  companyName?: string;
  portalMessage?: string;
  portalMessageType?: "info" | "warning" | "success";
}

interface RegistrationFields {
  companyName: string;
  dealerId: string;
  useCase: string;
  expectedVolume: string;
  webhookUrl: string;
  tosAccepted: boolean;
}

const PLANS: Plan[] = [
  { id: "catalog",   name: "Catalog",    tier: "free", approval: "auto", price: "Free",           rateLimit: "10 req/min",  monthlyQuota: "50,000 / month",    sla: "Best-effort",  apis: ["Vehicles", "Inventory", "Dealers"], description: "Read access to the product catalog, real-time inventory, and dealer network." },
  { id: "commerce",  name: "Commerce",   tier: "free", approval: "auto", price: "Free",           rateLimit: "10 req/min",  monthlyQuota: "50,000 / month",    sla: "Best-effort",  apis: ["Orders", "Pricing"],                description: "Access to order management and dealer pricing data." },
  { id: "pro",       name: "Pro",        tier: "paid", approval: "manual", price: "$1 / month",    rateLimit: "50 req/min",  monthlyQuota: "5,000,000 / month", sla: "99.9% uptime", apis: ["All APIs"], highlighted: true,       description: "Full API access with guaranteed uptime SLA. Recommended for production integrations." },
  { id: "enterprise",name: "Enterprise", tier: "paid", approval: "manual", price: "$500 / month", rateLimit: "Unlimited",   monthlyQuota: "Unlimited",         sla: "99.99% uptime",apis: ["All APIs"],                          description: "Maximum scale with dedicated support and custom rate limits." },
];

const USE_CASES = ["Inventory sync", "Order management", "Dealer pricing & quoting", "Reporting & analytics", "Customer portal integration", "Other"];
const VOLUME_OPTIONS = ["< 10,000 / month", "10,000 – 100,000 / month", "100,000 – 1,000,000 / month", "> 1,000,000 / month"];


const PLAN_PROBE: Record<string, string> = {
  catalog: "/v2/vehicles",
  commerce: "/v2/pricing",
  pro: "/v2/vehicles",
  enterprise: "/v2/vehicles",
};

function QuotaBar({ apiKey, planId }: { apiKey: string; planId: string }) {
  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    const endpoint = PLAN_PROBE[planId] ?? "/v2/vehicles";
    fetch(`${GATEWAY_URL}${endpoint}`, { headers: { Authorization: `Bearer ${apiKey}` } })
      .then((res) => {
        const allHeaders: Record<string, string> = {};
        res.headers.forEach((value, key) => { allHeaders[key] = value; });
        console.log("[QuotaBar] status:", res.status, "headers:", allHeaders);
        const remaining = parseInt(
          res.headers.get("RateLimit-Remaining") ??
          res.headers.get("X-RateLimit-Remaining") ??
          res.headers.get("x-ratelimit-remaining") ??
          res.headers.get("ratelimit-remaining") ??
          res.headers.get("X-Rate-Limit-Remaining") ?? ""
        );
        const limit = parseInt(
          res.headers.get("RateLimit-Limit") ??
          res.headers.get("X-RateLimit-Limit") ??
          res.headers.get("x-ratelimit-limit") ??
          res.headers.get("ratelimit-limit") ??
          res.headers.get("X-Rate-Limit-Limit") ?? ""
        );
        console.log("[QuotaBar] remaining:", remaining, "limit:", limit);
        if (!isNaN(remaining) && !isNaN(limit) && limit > 0) {
          setQuota({ remaining, limit });
          setStatus("ready");
        } else {
          setStatus("unavailable");
        }
      })
      .catch((err) => { console.log("[QuotaBar] probe failed:", err); setStatus("unavailable"); });
  }, [apiKey, planId]);

  if (status === "loading") return <div className="mt-3 text-xs text-muted-foreground animate-pulse">Loading quota…</div>;
  if (status === "unavailable" || !quota) return null;

  const used = quota.limit - quota.remaining;
  const pct = Math.min((used / quota.limit) * 100, 100);
  const barColor = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-primary";

  return (
    <div className="mt-3 space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Monthly quota</span>
        <span>{used.toLocaleString()} / {quota.limit.toLocaleString()} used</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MaskedKey({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span className="flex items-center gap-1 flex-1 min-w-0">
      <code className="flex-1 truncate text-sm font-mono">
        {revealed ? value : "•".repeat(Math.min(value.length, 32))}
      </code>
      <button onClick={() => setRevealed(r => !r)}
        className="ml-1 rounded px-2 py-0.5 text-xs font-medium border border-current opacity-70 hover:opacity-100 transition-opacity whitespace-nowrap">
        {revealed ? "Hide" : "Reveal"}
      </button>
    </span>
  );
}


function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="ml-2 rounded px-2 py-0.5 text-xs font-medium border border-current opacity-70 hover:opacity-100 transition-opacity">
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "info" | "error"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: "bg-green-600", info: "bg-blue-600", error: "bg-red-600" };
  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 text-white shadow-lg ${colors[type]}`} style={{ maxWidth: 380 }}>
      <span className="flex-1 text-sm">{message}</span>
      <button onClick={onClose} className="text-white/80 hover:text-white text-lg leading-none">×</button>
    </div>
  );
}

function RequestAccessModal({
  plan, onSubmit, onCancel, submitting,
}: {
  plan: Plan;
  onSubmit: (fields: RegistrationFields, turnstileToken: string) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [fields, setFields] = useState<RegistrationFields>({
    companyName: "", dealerId: "", useCase: "", expectedVolume: "", webhookUrl: "", tosAccepted: false,
  });
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [turnstileError, setTurnstileError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Load Turnstile script and render widget
  useEffect(() => {
    // Load Turnstile script if not already loaded
    if (!document.getElementById("cf-turnstile-script")) {
      const script = document.createElement("script");
      script.id = "cf-turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    // Render the widget once script is ready
    const renderWidget = () => {
      if (containerRef.current && (window as any).turnstile) {
        widgetIdRef.current = (window as any).turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITEKEY,
          theme: "light",
          size: "invisible",
          callback: (token: string) => {
            setTurnstileToken(token);
            setTurnstileError(false);
          },
          "error-callback": () => setTurnstileError(true),
          "expired-callback": () => setTurnstileToken(""),
        });
      }
    };

    if ((window as any).turnstile) {
      renderWidget();
    } else {
      // Wait for script to load
      const interval = setInterval(() => {
        if ((window as any).turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 100);
      return () => clearInterval(interval);
    }

    return () => {
      if (widgetIdRef.current && (window as any).turnstile) {
        try { (window as any).turnstile.remove(widgetIdRef.current); } catch {}
      }
    };
  }, []);

  const valid =
    fields.companyName.trim() &&
    fields.dealerId.trim() &&
    fields.useCase &&
    fields.expectedVolume &&
    fields.tosAccepted &&
    turnstileToken;

  const handleSubmit = () => {
    if (!turnstileToken) {
      // Trigger Turnstile challenge explicitly if token not yet issued
      if (widgetIdRef.current && (window as any).turnstile) {
        (window as any).turnstile.execute(widgetIdRef.current);
      }
      return;
    }
    onSubmit(fields, turnstileToken);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-1">Request {plan.name} Access</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Please provide your dealership details. This information helps Forest River review and approve your API access request.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Company Name <span className="text-destructive">*</span></label>
              <input type="text" placeholder="ABC RV Dealership" value={fields.companyName}
                onChange={e => setFields(f => ({ ...f, companyName: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Forest River Dealer ID <span className="text-destructive">*</span></label>
              <input type="text" placeholder="FR-1234" value={fields.dealerId}
                onChange={e => setFields(f => ({ ...f, dealerId: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <p className="mt-1 text-xs text-muted-foreground">Your existing Forest River dealer number</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Primary Use Case <span className="text-destructive">*</span></label>
              <select value={fields.useCase} onChange={e => setFields(f => ({ ...f, useCase: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select a use case…</option>
                {USE_CASES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Expected Monthly API Volume <span className="text-destructive">*</span></label>
              <select value={fields.expectedVolume} onChange={e => setFields(f => ({ ...f, expectedVolume: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select volume…</option>
                {VOLUME_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Webhook Endpoint URL <span className="text-muted-foreground text-xs font-normal">(optional)</span>
              </label>
              <input type="url" placeholder="https://yoursystem.com/fr-webhook" value={fields.webhookUrl}
                onChange={e => setFields(f => ({ ...f, webhookUrl: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <p className="mt-1 text-xs text-muted-foreground">Register an endpoint to receive signed event notifications from Forest River</p>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <input type="checkbox" id="tos" checked={fields.tosAccepted}
                  onChange={e => setFields(f => ({ ...f, tosAccepted: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer" />
                <label htmlFor="tos" className="text-sm cursor-pointer">
                  I agree to the{" "}
                  <a href="/authentication" className="text-primary underline hover:no-underline">Forest River API Terms of Service</a>
                  {" "}and acknowledge that API access is subject to Forest River's review and approval process.
                  By submitting this request, I confirm that my dealership is an authorized Forest River dealer.
                  <span className="text-destructive ml-1">*</span>
                </label>
              </div>
            </div>

            {/* Invisible Turnstile widget container */}
            <div ref={containerRef} />

            {turnstileError && (
              <p className="text-xs text-destructive">Bot protection challenge failed. Please refresh the page and try again.</p>
            )}

            {/* Powered by Cloudflare badge */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <svg className="w-3 h-3" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128 128-57.3 128-128S198.7 0 128 0z" fill="#F6821F"/>
              </svg>
              Protected by Cloudflare Turnstile
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onCancel} disabled={submitting}
              className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60">
              Cancel
            </button>
            <button onClick={handleSubmit}
              disabled={!fields.companyName.trim() || !fields.dealerId.trim() || !fields.useCase || !fields.expectedVolume || !fields.tosAccepted || submitting}
              className="flex-1 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
              {submitting ? "Submitting…" : `Request ${plan.name} Access`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubscribePage({ view: defaultView = "plans" }: { view?: "plans" | "subscriptions" }) {
  const [view, setView] = useState<"plans" | "subscriptions">(defaultView);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [modalPlan, setModalPlan] = useState<Plan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const [rollingKey, setRollingKey] = useState<string | null>(null);
  const [completingCheckout, setCompletingCheckout] = useState<string | null>(null);
  const auth = useAuth();
  const { authentication } = useZudoku();

  const showToast = useCallback((message: string, type: "success" | "info" | "error" = "success") => {
    setToast({ message, type });
  }, []);

  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const req = new Request(url, options);
    const signed = await authentication?.signRequest(req);
    return fetch(signed ?? req);
  }, [authentication]);

  const fetchSubscriptions = useCallback(async () => {
    if (!auth.isAuthenticated) return;
    try {
      const res = await authFetch(`${GATEWAY_URL}/subscriptions`);
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(prev => {
          data.forEach((sub: Subscription) => {
            const old = prev.find(s => s.id === sub.id);
            if ((old?.status === "pending" || old?.status === "approved_pending_payment") && sub.status === "active") {
              showToast(`🎉 ${sub.planName} access approved! Your API key is ready.`, "success");
            }
          });
          return data;
        });
      }
    } catch (err) { console.error("Failed to fetch subscriptions", err); }
  }, [auth.isAuthenticated, authFetch, showToast]);

  useEffect(() => { if (auth.isAuthenticated) fetchSubscriptions(); }, [auth.isAuthenticated, fetchSubscriptions]);

  useEffect(() => {
    const hasPending = subscriptions.some(s => s.status === "pending" || s.status === "approved_pending_payment");
    if (!hasPending) return;
    const interval = setInterval(fetchSubscriptions, 5000);
    return () => clearInterval(interval);
  }, [subscriptions, fetchSubscriptions]);

  const [pendingCheckoutComplete, setPendingCheckoutComplete] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      setView("subscriptions");
      window.history.replaceState({}, "", window.location.pathname);
      setPendingCheckoutComplete(true);
    } else if (params.get("checkout") === "cancelled") {
      showToast("Checkout cancelled. You can try again from My Subscriptions.", "info");
      setView("subscriptions");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [showToast]);

  useEffect(() => {
    if (!pendingCheckoutComplete || !auth.isAuthenticated) return;
    setPendingCheckoutComplete(false);
    (async () => {
      try {
        const subsRes = await authFetch(`${GATEWAY_URL}/subscriptions`);
        const subs: Subscription[] = subsRes.ok ? await subsRes.json() : [];
        const pending = subs.find(s => s.status === "approved_pending_payment");
        if (pending) {
          const res = await authFetch(`${GATEWAY_URL}/subscriptions/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscriptionId: pending.id }),
          });
          if (res.ok) {
            await fetchSubscriptions();
            showToast("Subscription active! Your API key is ready.", "success");
            return;
          }
        }
      } catch { /* fall through */ }
      await fetchSubscriptions();
      showToast("Subscription complete! Your API key will appear shortly.", "success");
    })();
  }, [pendingCheckoutComplete, auth.isAuthenticated, authFetch, fetchSubscriptions, showToast]);

  const getSubscriptionForPlan = (planId: string) =>
    subscriptions.find(s => s.planId === planId && s.status !== "rejected");

  const handleRequestAccess = (plan: Plan) => {
    if (!auth.isAuthenticated) { auth.login(); return; }
    if (getSubscriptionForPlan(plan.id)) return;
    setModalPlan(plan);
  };

  const handleSubmit = async (fields: RegistrationFields, turnstileToken: string) => {
    if (!modalPlan) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`${GATEWAY_URL}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: modalPlan.id, planName: modalPlan.name,
          companyName: fields.companyName, dealerId: fields.dealerId,
          useCase: fields.useCase, expectedVolume: fields.expectedVolume,
          webhookUrl: fields.webhookUrl,
          tosAccepted: fields.tosAccepted, tosAcceptedAt: new Date().toISOString(),
          turnstileToken,
          userEmail: (auth.profile as any)?.email ?? "",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const sub: Subscription = await res.json();
      setSubscriptions(prev => [...prev, sub]);
      setModalPlan(null);
      if (sub.status === "active") showToast(`✅ API key provisioned for ${modalPlan.name} plan!`, "success");
      else showToast(`⏳ Request submitted for ${modalPlan.name}. Awaiting admin approval.`, "info");
    } catch (err) {
      showToast("Failed to submit request. Please try again.", "error");
      console.error(err);
    } finally { setSubmitting(false); }
  };

  const handleCompleteSubscription = async (sub: Subscription) => {
    setCompletingCheckout(sub.id);
    try {
      const res = await authFetch(`${GATEWAY_URL}/subscriptions/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: sub.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      window.location.href = url;
    } catch (err: any) {
      showToast("Failed to start checkout. Please try again.", "error");
      setCompletingCheckout(null);
    }
  };

  const handleRollKey = async (sub: Subscription) => {
    if (!confirm("Roll your API key? Both your old and new keys will work for 1 hour, then the old one stops working.")) return;
    setRollingKey(sub.id);
    try {
      const res = await authFetch(`${GATEWAY_URL}/subscriptions/roll-key`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: sub.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSubscriptions(prev => prev.map(s => s.id === sub.id ? { ...s, apiKey: data.apiKey, oldKey: data.oldKey, oldKeyExpiry: data.oldKeyExpiry } : s));
      showToast("🔑 Key rolled! Your new key is shown below. Old key valid for 1 hour.", "success");
    } catch (err: any) {
      showToast(`Failed to roll key: ${err.message}`, "error");
    } finally { setRollingKey(null); }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {modalPlan && (
        <RequestAccessModal plan={modalPlan} onSubmit={handleSubmit} onCancel={() => setModalPlan(null)} submitting={submitting} />
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">API Access</h1>
        <p className="text-muted-foreground">Choose a plan and get your API key to start building with the Forest River API.</p>
      </div>

      <div className="flex gap-1 mb-8 rounded-lg border p-1 w-fit bg-muted">
        {(["plans", "subscriptions"] as const).map(tab => (
          <button key={tab} onClick={() => setView(tab)}
            className={`rounded-md px-5 py-1.5 text-sm font-medium transition-colors ${view === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {tab === "plans" ? "Plans" : "My Subscriptions"}
            {tab === "subscriptions" && subscriptions.filter(s => s.status !== "rejected").length > 0 && (
              <span className="ml-2 rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5">
                {subscriptions.filter(s => s.status !== "rejected").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {view === "plans" && (
        <div className="space-y-8">
          {(["free", "paid"] as const).map(tier => (
            <div key={tier}>
              <div className="flex items-center gap-3 mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tier === "free" ? "Free Tier" : "Paid Plans — Admin review"}
                </p>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {PLANS.filter(p => p.tier === tier).map(plan => {
                  const sub = getSubscriptionForPlan(plan.id);
                  return (
                    <div key={plan.id} className={`relative flex flex-col rounded-xl border p-6 ${plan.highlighted ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border bg-card"}`}>
                      {plan.highlighted && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">Recommended</span>
                        </div>
                      )}
                      <div className="mb-4">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="text-xl font-bold">{plan.name}</h2>
                          <span className={`text-lg font-bold ${plan.tier === "free" ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>
                            {plan.price}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                      </div>
                      <dl className="mb-4 space-y-2 text-sm">
                        {[["Rate limit", plan.rateLimit], ["Monthly quota", plan.monthlyQuota], ["SLA", plan.sla], ["Approval", "Admin review"]].map(([label, value]) => (
                          <div key={label} className="flex justify-between">
                            <dt className="text-muted-foreground">{label}</dt>
                            <dd className="font-medium">{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mb-5">
                        <p className="text-xs text-muted-foreground mb-1.5">API access</p>
                        <div className="flex flex-wrap gap-1.5">
                          {plan.apis.map(api => (
                            <span key={api} className="rounded-full border bg-muted/60 px-2 py-0.5 text-xs font-medium">{api}</span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-auto">
                        {!sub && (
                          <button onClick={() => handleRequestAccess(plan)}
                            className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${plan.highlighted ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border bg-background hover:bg-muted"}`}>
                            {!auth.isAuthenticated ? "Sign in to request access" : "Request access"}
                          </button>
                        )}
                        {sub?.status === "pending" && (
                          <div className="flex items-center justify-center gap-2 rounded-lg border border-yellow-400 bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-800 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-300">
                            <span className="animate-pulse">⏳</span> Pending admin approval…
                          </div>
                        )}
                        {sub?.status === "suspended" && (
                          <div className="flex items-center justify-center gap-2 rounded-lg border border-orange-400 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-800 dark:border-orange-600 dark:bg-orange-950 dark:text-orange-300">
                            ⏸️ Access suspended
                          </div>
                        )}
                        {sub?.status === "active" && (
                          <div className="rounded-lg border border-green-500 bg-green-50 p-3 dark:border-green-700 dark:bg-green-950">
                            <p className="text-xs font-medium text-green-800 dark:text-green-300">✅ Access granted — view your key in My Subscriptions</p>
                          </div>
                        )}
                        {sub?.status === "approved_pending_payment" && (
                          <div className="rounded-lg border border-blue-500 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-950">
                            <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1.5">✅ Approved — complete your subscription to activate</p>
                            <button onClick={() => setView("subscriptions")} className="text-xs text-blue-700 dark:text-blue-400 underline hover:no-underline">
                              Complete subscription →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "subscriptions" && (
        <div>
          {!auth.isAuthenticated ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">Sign in to view your subscriptions</p>
              <button onClick={() => auth.login()} className="mt-4 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">Sign in</button>
            </div>
          ) : subscriptions.filter(s => s.status !== "rejected").length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">No subscriptions yet</p>
              <button onClick={() => setView("plans")} className="mt-4 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Browse plans</button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Per-subscription announcements */}
              {subscriptions.filter(s => s.portalMessage).map(sub => {
                const colors = {
                  warning: "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
                  success: "border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-300",
                  info: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300",
                };
                const colorClass = colors[sub.portalMessageType ?? "info"];
                return (
                  <div key={`announce-${sub.id}`} className={`rounded-lg border p-3 text-sm ${colorClass}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-medium mr-2">{sub.planName} Plan</span>
                        {sub.portalMessage}
                      </div>
                    </div>
                  </div>
                );
              })}
              {subscriptions.filter(s => s.status !== "rejected").map(sub => {
                const plan = PLANS.find(p => p.id === sub.planId);
                return (
                  <div key={sub.id} className="rounded-xl border bg-card p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{sub.planName}</h3>
                          {sub.companyName && <span className="text-muted-foreground text-sm">— {sub.companyName}</span>}
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            sub.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" :
                            sub.status === "suspended" ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300" :
                            sub.status === "approved_pending_payment" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" :
                            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                          }`}>
                            {sub.status === "active" ? "Active" : sub.status === "suspended" ? "Suspended" : sub.status === "approved_pending_payment" ? "Approved" : "Pending"}
                          </span>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
                          {plan && <>
                            <div><dt className="text-muted-foreground">Rate limit</dt><dd className="font-medium">{plan.rateLimit}</dd></div>
                            <div><dt className="text-muted-foreground">Monthly quota</dt><dd className="font-medium">{plan.monthlyQuota}</dd></div>
                          </>}
                          <div><dt className="text-muted-foreground">Requested</dt><dd className="font-medium">{new Date(sub.requestedAt).toLocaleDateString()}</dd></div>
                        </dl>
                        {sub.status === "active" && sub.apiKey && (
                          <div className="mt-4 space-y-2">
                            <div className="rounded-lg border bg-muted/50 p-3">
                              <p className="mb-1 text-xs font-medium text-muted-foreground">Current API Key</p>
                              <div className="flex items-center">
                                <MaskedKey value={sub.apiKey} />
                                <CopyButton text={sub.apiKey} />
                                <button
                                  onClick={() => handleRollKey(sub)}
                                  disabled={rollingKey === sub.id}
                                  className="border text-xs px-2 py-0.5 rounded hover:bg-muted transition-colors ml-2 disabled:opacity-60"
                                >
                                  {rollingKey === sub.id ? "Rolling…" : "Roll Key"}
                                </button>
                              </div>

                            </div>
                            {sub.oldKey && sub.oldKeyExpiry && new Date(sub.oldKeyExpiry) > new Date() && (
                              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950 p-3 text-xs text-amber-800 dark:text-amber-300">
                                <p className="mb-1.5 font-medium">⚠️ Previous key — expires {new Date(sub.oldKeyExpiry).toLocaleString()}</p>
                                <div className="flex items-center">
                                  <MaskedKey value={sub.oldKey} />
                                  <CopyButton text={sub.oldKey} />
                                </div>
                              </div>
                            )}
                            <QuotaBar apiKey={sub.apiKey} planId={sub.planId} />
                          </div>
                        )}
                        {sub.status === "suspended" && (
                          <div className="mt-4 flex items-center gap-2 text-sm text-orange-700 dark:text-orange-400 rounded-lg border border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950 px-3 py-2">
                            ⏸️ Your API access has been suspended. Contact your Forest River representative.
                          </div>
                        )}
                        {sub.status === "pending" && (
                          <div className="mt-4 flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
                            <span className="animate-pulse">⏳</span> Waiting for admin approval — checking every 5 seconds…
                          </div>
                        )}
                        {sub.status === "approved_pending_payment" && (
                          <div className="mt-4 rounded-lg border border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950 p-4">
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-3">
                              ✅ Access approved — complete your subscription to receive your API key
                            </p>
                            <button
                              onClick={() => handleCompleteSubscription(sub)}
                              disabled={completingCheckout === sub.id}
                              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                            >
                              {completingCheckout === sub.id ? "Redirecting to Stripe…" : "Complete subscription →"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SubscribePage;
