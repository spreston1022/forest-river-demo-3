import { useState, useEffect, useCallback } from "react";
import { useAuth, useZudoku } from "zudoku/hooks";

const GATEWAY_URL = import.meta.env.ZUPLO_PUBLIC_SERVER_URL ?? "https://forest-river-demo-main-fb06bf1.zuplo.app";
const ADMIN_EMAIL = "sam@zuplo.com";
const ADMIN_SUB = "auth0|69e72c26c61be620e134af9b";

interface Subscription {
  id: string; planId: string; planName: string;
  userId: string; userEmail: string; companyName: string;
  dealerId: string; useCase: string; expectedVolume: string;
  webhookUrl: string; tosAccepted: boolean; tosAcceptedAt: string;
  status: "pending" | "active" | "rejected";
  apiKey?: string; requestedAt: string; resolvedAt?: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[status] || ""}`}>{status}</span>;
}

export function AdminPage() {
  const auth = useAuth();
  const { authentication } = useZudoku();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "rejected">("pending");
  const [expanded, setExpanded] = useState<string | null>(null);

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

  // Check by sub (more reliable than email)
  const isAdmin = (auth.profile as any)?.email === ADMIN_EMAIL;

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-white shadow-lg text-sm ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`} style={{ maxWidth: 380 }}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Admin — Subscription Requests</h1>
          <p className="text-muted-foreground text-sm">
            {pendingCount > 0 ? `${pendingCount} pending request${pendingCount > 1 ? "s" : ""} awaiting approval` : "No pending requests"}
            {" · "}<button onClick={fetchAll} className="underline hover:no-underline text-primary">Refresh</button>
          </p>
        </div>
        <div className="flex gap-2">
          {(["pending", "active", "rejected", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
              {f}{f === "pending" && pendingCount > 0 && <span className="ml-1 rounded-full bg-white text-primary text-xs px-1">{pendingCount}</span>}
            </button>
          ))}
        </div>
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
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 p-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{sub.companyName || sub.userEmail}</h3>
                    <StatusBadge status={sub.status} />
                    <span className="text-sm text-muted-foreground">{sub.planName} Plan</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
                    <div><span className="text-muted-foreground">Email: </span><span className="font-medium">{sub.userEmail}</span></div>
                    {sub.dealerId && <div><span className="text-muted-foreground">Dealer ID: </span><span className="font-medium">{sub.dealerId}</span></div>}
                    {sub.useCase && <div><span className="text-muted-foreground">Use case: </span><span className="font-medium">{sub.useCase}</span></div>}
                    <div><span className="text-muted-foreground">Requested: </span><span className="font-medium">{new Date(sub.requestedAt).toLocaleDateString()}</span></div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                  >
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

              {/* Expanded details */}
              {expanded === sub.id && (
                <div className="border-t bg-muted/30 px-6 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                    {sub.expectedVolume && (
                      <div><p className="text-muted-foreground text-xs mb-0.5">Expected Volume</p><p className="font-medium">{sub.expectedVolume}</p></div>
                    )}
                    {sub.webhookUrl && (
                      <div><p className="text-muted-foreground text-xs mb-0.5">Webhook Endpoint</p><p className="font-medium truncate text-xs font-mono">{sub.webhookUrl}</p></div>
                    )}
                    {sub.resolvedAt && (
                      <div><p className="text-muted-foreground text-xs mb-0.5">Resolved</p><p className="font-medium">{new Date(sub.resolvedAt).toLocaleDateString()}</p></div>
                    )}
                  </div>
                  <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${sub.tosAccepted ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300"}`}>
                    <span>{sub.tosAccepted ? "✅" : "❌"}</span>
                    <span>
                      {sub.tosAccepted
                        ? `Terms of Service accepted${sub.tosAcceptedAt ? ` on ${new Date(sub.tosAcceptedAt).toLocaleString()}` : ""}`
                        : "Terms of Service not accepted"}
                    </span>
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
  );
}

export default AdminPage;