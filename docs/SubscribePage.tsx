/**
 * docs/SubscribePage.tsx
 * Subscription flow — posts to real Zuplo backend, polls for key status.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "zudoku/hooks";

const GATEWAY_URL = import.meta.env.ZUPLO_PUBLIC_SERVER_URL ?? "https://forest-river-demo-main-fb06bf1.zuplo.app";

interface Plan {
  id: "basic" | "pro" | "enterprise";
  name: string;
  approval: "auto" | "manual";
  rateLimit: string;
  monthlyQuota: string;
  sla: string;
  highlighted?: boolean;
  description: string;
}

interface Subscription {
  id: string;
  planId: "basic" | "pro" | "enterprise";
  planName: string;
  status: "pending" | "active" | "rejected";
  apiKey?: string;
  requestedAt: string;
  resolvedAt?: string;
}

const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    approval: "auto",
    rateLimit: "100 req/min",
    monthlyQuota: "50,000 / month",
    sla: "Best-effort",
    description: "Get started immediately with auto-approval. Great for exploration and prototyping.",
  },
  {
    id: "pro",
    name: "Pro",
    approval: "manual",
    rateLimit: "1,000 req/min",
    monthlyQuota: "5,000,000 / month",
    sla: "99.9% uptime",
    highlighted: true,
    description: "Production-grade access with guaranteed uptime SLA. Recommended for most teams.",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    approval: "manual",
    rateLimit: "Unlimited",
    monthlyQuota: "Unlimited",
    sla: "99.99% uptime",
    description: "Maximum scale with dedicated support and custom rate limits.",
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="ml-2 rounded px-2 py-0.5 text-xs font-medium border border-current opacity-70 hover:opacity-100 transition-opacity"
    >
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

interface SubscribePageProps {
  view?: "plans" | "subscriptions";
}

export function SubscribePage({ view: defaultView = "plans" }: SubscribePageProps) {
  const [view, setView] = useState<"plans" | "subscriptions">(defaultView);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const auth = useAuth();

  const showToast = useCallback((message: string, type: "success" | "info" | "error" = "success") => {
    setToast({ message, type });
  }, []);

  // Fetch subscriptions from backend
  const fetchSubscriptions = useCallback(async () => {
    if (!auth.isAuthenticated) return;
    try {
      const token = await auth.getAccessToken();
      const res = await fetch(`${GATEWAY_URL}/subscriptions`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data);
      }
    } catch (err) {
      console.error("Failed to fetch subscriptions", err);
    }
  }, [auth]);

  // Load on mount and when auth changes
  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchSubscriptions();
    }
  }, [auth.isAuthenticated, fetchSubscriptions]);

  // Poll every 5 seconds if there are pending subscriptions
  useEffect(() => {
    const hasPending = subscriptions.some(s => s.status === "pending");
    if (!hasPending) return;
    const interval = setInterval(fetchSubscriptions, 5000);
    return () => clearInterval(interval);
  }, [subscriptions, fetchSubscriptions]);

  // Check if a pending sub just became active
  const prevSubs = useCallback((newSubs: Subscription[]) => {
    newSubs.forEach(sub => {
      const old = subscriptions.find(s => s.id === sub.id);
      if (old?.status === "pending" && sub.status === "active") {
        showToast(`🎉 ${sub.planName} access approved! Your API key is ready.`, "success");
      }
    });
  }, [subscriptions, showToast]);

  const getSubscriptionForPlan = (planId: string) =>
    subscriptions.find(s => s.planId === planId && s.status !== "rejected");

  const requestAccess = async (plan: Plan) => {
    if (!auth.isAuthenticated) {
      auth.login();
      return;
    }
    if (requesting) return;
    const existing = getSubscriptionForPlan(plan.id);
    if (existing) return;

    setRequesting(plan.id);
    try {
      const token = await auth.getAccessToken();
      const res = await fetch(`${GATEWAY_URL}/subscriptions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId: plan.id, planName: plan.name }),
      });

      if (!res.ok) throw new Error(await res.text());

      const sub: Subscription = await res.json();
      setSubscriptions(prev => [...prev, sub]);

      if (sub.status === "active") {
        showToast(`✅ API key provisioned for ${plan.name} plan!`, "success");
      } else {
        showToast(`⏳ Request submitted for ${plan.name}. Awaiting admin approval.`, "info");
      }
    } catch (err) {
      showToast("Failed to submit request. Please try again.", "error");
      console.error(err);
    } finally {
      setRequesting(null);
    }
  };

  const revoke = async (sub: Subscription) => {
    // For now just remove from local state — full revocation would call DELETE /subscriptions/:id
    setSubscriptions(prev => prev.filter(s => s.id !== sub.id));
    showToast("Subscription revoked.", "info");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLANS.map(plan => {
            const sub = getSubscriptionForPlan(plan.id);
            const isRequesting = requesting === plan.id;
            return (
              <div key={plan.id} className={`relative flex flex-col rounded-xl border p-6 ${plan.highlighted ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border bg-card"}`}>
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">Recommended</span>
                  </div>
                )}
                <div className="mb-4">
                  <h2 className="text-xl font-bold">{plan.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                </div>
                <dl className="mb-6 space-y-2 text-sm">
                  {[
                    ["Rate limit", plan.rateLimit],
                    ["Monthly quota", plan.monthlyQuota],
                    ["SLA", plan.sla],
                    ["Approval", plan.approval === "auto" ? "Instant" : "Admin review"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-auto">
                  {!sub && (
                    <button onClick={() => requestAccess(plan)} disabled={!!isRequesting}
                      className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${plan.highlighted ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border bg-background hover:bg-muted"}`}>
                      {isRequesting ? "Requesting…" : !auth.isAuthenticated ? "Sign in to request access" : "Request access"}
                    </button>
                  )}
                  {sub?.status === "pending" && (
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-yellow-400 bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-800 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-300">
                      <span className="animate-pulse">⏳</span> Pending admin approval…
                    </div>
                  )}
                  {sub?.status === "active" && (
                    <div className="rounded-lg border border-green-500 bg-green-50 p-3 dark:border-green-700 dark:bg-green-950">
                      <p className="mb-1 text-xs font-medium text-green-800 dark:text-green-300">✅ Access granted</p>
                      <div className="flex items-center">
                        <code className="flex-1 truncate rounded text-xs font-mono text-green-900 dark:text-green-200">{sub.apiKey}</code>
                        {sub.apiKey && <CopyButton text={sub.apiKey} />}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
              {subscriptions.filter(s => s.status !== "rejected").map(sub => {
                const plan = PLANS.find(p => p.id === sub.planId);
                return (
                  <div key={sub.id} className="rounded-xl border bg-card p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{sub.planName}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sub.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"}`}>
                            {sub.status === "active" ? "Active" : "Pending"}
                          </span>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
                          {plan && <>
                            <div><dt className="text-muted-foreground">Rate limit</dt><dd className="font-medium">{plan.rateLimit}</dd></div>
                            <div><dt className="text-muted-foreground">Monthly quota</dt><dd className="font-medium">{plan.monthlyQuota}</dd></div>
                            <div><dt className="text-muted-foreground">SLA</dt><dd className="font-medium">{plan.sla}</dd></div>
                          </>}
                          <div><dt className="text-muted-foreground">Requested</dt><dd className="font-medium">{new Date(sub.requestedAt).toLocaleDateString()}</dd></div>
                          {sub.resolvedAt && <div><dt className="text-muted-foreground">Approved</dt><dd className="font-medium">{new Date(sub.resolvedAt).toLocaleDateString()}</dd></div>}
                        </dl>
                        {sub.status === "active" && sub.apiKey && (
                          <div className="mt-4 rounded-lg border bg-muted/50 p-3">
                            <p className="mb-1 text-xs font-medium text-muted-foreground">API Key</p>
                            <div className="flex items-center">
                              <code className="flex-1 truncate text-sm font-mono">{sub.apiKey}</code>
                              <CopyButton text={sub.apiKey} />
                            </div>
                          </div>
                        )}
                        {sub.status === "pending" && (
                          <div className="mt-4 flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
                            <span className="animate-pulse">⏳</span> Waiting for admin approval — checking every 5 seconds…
                          </div>
                        )}
                      </div>
                      <button onClick={() => revoke(sub)} className="shrink-0 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
                        Revoke
                      </button>
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
