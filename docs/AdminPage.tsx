import { useState, useEffect, useCallback } from "react";
import { useAuth, useZudoku } from "zudoku/hooks";

const GATEWAY_URL = import.meta.env.ZUPLO_PUBLIC_SERVER_URL ?? "https://forest-river-demo-main-fb06bf1.zuplo.app";

interface Subscription {
  id: string; planId: string; planName: string;
  userId: string; userEmail: string; companyName: string;
  dealerId: string; useCase: string; expectedVolume: string;
  webhookUrl: string; tosAccepted: boolean; tosAcceptedAt: string;
  status: "pending" | "active" | "rejected";
  apiKey?: string; requestedAt: string; resolvedAt?: string;
}

const PLANS = [
  { id: "basic", name: "Basic", rateLimit: "100 req/min", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
  { id: "pro", name: "Pro", rateLimit: "15 req/min", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" },
  { id: "enterprise", name: "Enterprise", rateLimit: "Unlimited", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
];

type TabType = "requests" | "groups";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[status] || ""}`}>{status}</span>;
}

function PlanBadge({ planId }: { planId: string }) {
  const plan = PLANS.find(p => p.id === planId);
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${plan?.color || ""}`}>{plan?.name ?? planId}</span>;
}

export function AdminPage() {
  const auth = useAuth();
  const { authentication } = useZudoku();
  const [tab, setTab] = useState<TabType>("requests");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "rejected">("pending");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [movingPlan, setMovingPlan] = useState<Record<string, string>>({});

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const req = new Request(url, options);
    const signed = await authentication?.signRequest(req);
    return fetch(signed ?? req);
  }, [authentication]);

  const fetchAll = useCallback(async () => {
    if (!auth.isAuthenticated) return;
    setLoading(true);
    try {
      const res = await authFetch(`${GATEWAY_URL}/admin/subscriptions`);
      if (res.ok) setSubscriptions(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [auth.isAuthenticated, authFetch]);

  useEffect(() => { if (auth.isAuthenticated) fetchAll(); }, [auth.isAuthenticated, fetchAll]);
  useEffect(() => { const i = setInterval(fetchAll, 10000); return () => clearInterval(i); }, [fetchAll]);

  const approve = async (sub: Subscription) => {
    setActing(sub.id);
    try {
      const res = await authFetch(`${GATEWAY_URL}/admin/subscriptions/${sub.id}/approve`, { method: "POST" });
      if (res.ok) { const u = await res.json(); setSubscriptions(prev => prev.map(s => s.id === u.id ? u : s)); showToast(`✅ Approved ${sub.planName} for ${sub.companyName || sub.userEmail}`); }
      else showToast(`Failed: ${await res.text()}`, "error");
    } catch { showToast("Error approving", "error"); }
    finally { setActing(null); }
  };

  const reject = async (sub: Subscription) => {
    setActing(sub.id);
    try {
      const res = await authFetch(`${GATEWAY_URL}/admin/subscriptions/${sub.id}/reject`, { method: "POST" });
      if (res.ok) { const u = await res.json(); setSubscriptions(prev => prev.map(s => s.id === u.id ? u : s)); showToast(`Rejected ${sub.planName} for ${sub.companyName || sub.userEmail}`, "error"); }
      else showToast(`Failed: ${await res.text()}`, "error");
    } catch { showToast("Error rejecting", "error"); }
    finally { setActing(null); }
  };

  const moveToGroup = async (sub: Subscription, newPlanId: string) => {
    if (newPlanId === sub.planId) return;
    const newPlan = PLANS.find(p => p.id === newPlanId);
    setActing(sub.id);
    try {
      const res = await authFetch(`${GATEWAY_URL}/admin/subscriptions/${sub.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: newPlanId, planName: newPlan?.name }),
      });
      if (res.ok) {
        const u = await res.json();
        setSubscriptions(prev => prev.map(s => s.id === u.id ? u : s));
        showToast(`✅ Moved ${sub.companyName || sub.userEmail} to ${newPlan?.name} — rate limit updated immediately`);
        setMovingPlan(prev => { const n = { ...prev }; delete n[sub.id]; return n; });
      } else showToast(`Failed: ${await res.text()}`, "error");
    } catch { showToast("Error moving consumer", "error"); }
    finally { setActing(null); }
  };

  const isAdmin = (auth.profile as any)?.email === "sam@zuplo.com";

  if (!auth.isAuthenticated) return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-lg font-medium text-muted-foreground mb-4">Sign in to access the admin panel.</p>
      <button onClick={() => auth.login()} className="rounded-lg bg-primary text-primary-foreground px-6 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors">Sign in</button>
    </div>
  );

  if (!isAdmin) return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-lg font-medium text-destructive">Access denied — admin only.</p>
    </div>
  );

  const filtered = filter === "all" ? subscriptions : subscriptions.filter(s => s.status === filter);
  const pendingCount = subscriptions.filter(s => s.status === "pending").length;
  const activeCount = subscriptions.filter(s => s.status === "active").length;

  // Group active consumers by plan
  const activeByPlan = PLANS.map(plan => ({
    ...plan,
    members: subscriptions.filter(s => s.status === "active" && s.planId === plan.id),
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-white shadow-lg text-sm ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`} style={{ maxWidth: 400 }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          {pendingCount > 0 && <span className="text-yellow-600 dark:text-yellow-400 font-medium">{pendingCount} pending approval · </span>}
          {activeCount} active consumers
          {" · "}<button onClick={fetchAll} className="underline hover:no-underline text-primary">Refresh</button>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 rounded-lg border p-1 w-fit bg-muted">
        {([
          { id: "requests", label: "Subscription Requests", badge: pendingCount > 0 ? pendingCount : null },
          { id: "groups", label: "Group Management", badge: null },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`rounded-md px-5 py-1.5 text-sm font-medium transition-colors ${tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
            {t.badge && <span className="ml-2 rounded-full bg-yellow-500 text-white text-xs px-1.5 py-0.5">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ── REQUESTS TAB ── */}
      {tab === "requests" && (
        <div>
          <div className="flex gap-2 mb-6">
            {(["pending", "active", "rejected", "all"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
                {f}{f === "pending" && pendingCount > 0 && <span className="ml-1 rounded-full bg-white text-primary text-xs px-1">{pendingCount}</span>}
              </button>
            ))}
          </div>

          {loading && subscriptions.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">No {filter === "all" ? "" : filter} requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(sub => (
                <div key={sub.id} className={`rounded-xl border bg-card overflow-hidden ${sub.status === "pending" ? "border-yellow-300 dark:border-yellow-700" : ""}`}>
                  <div className="flex items-start justify-between gap-4 p-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-lg">{sub.companyName || sub.userEmail}</h3>
                        <StatusBadge status={sub.status} />
                        <PlanBadge planId={sub.planId} />
                      </div>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
                        <div><span className="text-muted-foreground">Email: </span><span className="font-medium">{sub.userEmail}</span></div>
                        {sub.dealerId && <div><span className="text-muted-foreground">Dealer ID: </span><span className="font-medium">{sub.dealerId}</span></div>}
                        {sub.useCase && <div><span className="text-muted-foreground">Use case: </span><span className="font-medium">{sub.useCase}</span></div>}
                        <div><span className="text-muted-foreground">Requested: </span><span className="font-medium">{new Date(sub.requestedAt).toLocaleDateString()}</span></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                        {expanded === sub.id ? "Less" : "Details"}
                      </button>
                      {sub.status === "pending" && (
                        <>
                          <button onClick={() => approve(sub)} disabled={acting === sub.id}
                            className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors">
                            {acting === sub.id ? "…" : "Approve"}
                          </button>
                          <button onClick={() => reject(sub)} disabled={acting === sub.id}
                            className="rounded-lg border border-destructive/40 text-destructive px-4 py-2 text-sm font-semibold hover:bg-destructive/10 disabled:opacity-60 transition-colors">
                            {acting === sub.id ? "…" : "Reject"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {expanded === sub.id && (
                    <div className="border-t bg-muted/30 px-6 py-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                        {sub.expectedVolume && <div><p className="text-muted-foreground text-xs mb-0.5">Expected Volume</p><p className="font-medium">{sub.expectedVolume}</p></div>}
                        {sub.webhookUrl && <div><p className="text-muted-foreground text-xs mb-0.5">Webhook Endpoint</p><p className="font-medium truncate text-xs font-mono">{sub.webhookUrl}</p></div>}
                        {sub.resolvedAt && <div><p className="text-muted-foreground text-xs mb-0.5">Resolved</p><p className="font-medium">{new Date(sub.resolvedAt).toLocaleDateString()}</p></div>}
                      </div>
                      <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${sub.tosAccepted ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300"}`}>
                        <span>{sub.tosAccepted ? "✅" : "❌"}</span>
                        <span>{sub.tosAccepted ? `Terms of Service accepted${sub.tosAcceptedAt ? ` on ${new Date(sub.tosAcceptedAt).toLocaleString()}` : ""}` : "Terms of Service not accepted"}</span>
                      </div>
                      {sub.status === "active" && sub.apiKey && (
                        <div><p className="text-muted-foreground text-xs mb-0.5">API Key</p><p className="font-mono text-xs truncate">{sub.apiKey.slice(0, 24)}…</p></div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── GROUP MANAGEMENT TAB ── */}
      {tab === "groups" && (
        <div>
          <p className="text-sm text-muted-foreground mb-6">
            Consumers are grouped by their plan tier. Moving a consumer to a different group updates their rate limit immediately — no key re-provisioning needed.
          </p>

          {/* Group summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {activeByPlan.map(plan => (
              <div key={plan.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <PlanBadge planId={plan.id} />
                  <span className="text-2xl font-bold">{plan.members.length}</span>
                </div>
                <p className="text-xs text-muted-foreground">Rate limit: {plan.rateLimit}</p>
              </div>
            ))}
          </div>

          {/* Per-group member lists */}
          <div className="space-y-8">
            {activeByPlan.map(plan => (
              <div key={plan.id}>
                <div className="flex items-center gap-3 mb-3">
                  <PlanBadge planId={plan.id} />
                  <h2 className="font-semibold">{plan.name} Group</h2>
                  <span className="text-sm text-muted-foreground">— {plan.rateLimit}</span>
                </div>

                {plan.members.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                    No active consumers in this group
                  </div>
                ) : (
                  <div className="space-y-2">
                    {plan.members.map(sub => (
                      <div key={sub.id} className="rounded-xl border bg-card p-4 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-medium">{sub.companyName || sub.userEmail}</p>
                            {sub.dealerId && <span className="text-xs text-muted-foreground">· {sub.dealerId}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{sub.userEmail}{sub.useCase ? ` · ${sub.useCase}` : ""}</p>
                        </div>

                        {/* Move to group */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">Move to:</span>
                          <select
                            value={movingPlan[sub.id] ?? sub.planId}
                            onChange={e => setMovingPlan(prev => ({ ...prev, [sub.id]: e.target.value }))}
                            className="rounded-lg border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {PLANS.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => moveToGroup(sub, movingPlan[sub.id] ?? sub.planId)}
                            disabled={acting === sub.id || (movingPlan[sub.id] ?? sub.planId) === sub.planId}
                            className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
                          >
                            {acting === sub.id ? "…" : "Apply"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;