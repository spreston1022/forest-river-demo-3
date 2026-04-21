/**
 * docs/AdminPage.tsx
 * Admin approval page — only visible to sam@zuplo.com
 * Route: /admin in zudoku.config.tsx with display function checking email
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "zudoku/hooks";

const GATEWAY_URL = import.meta.env.ZUPLO_PUBLIC_SERVER_URL ?? "https://forest-river-demo-main-fb06bf1.zuplo.app";
const ADMIN_EMAIL = "sam@zuplo.com";

interface Subscription {
  id: string;
  planId: string;
  planName: string;
  userId: string;
  userEmail: string;
  userName: string;
  status: "pending" | "active" | "rejected";
  apiKey?: string;
  requestedAt: string;
  resolvedAt?: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[status] || ""}`}>
      {status}
    </span>
  );
}

export function AdminPage() {
  const auth = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "rejected">("pending");

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    if (!auth.isAuthenticated) return;
    setLoading(true);
    try {
      const token = await auth.getAccessToken();
      const res = await fetch(`${GATEWAY_URL}/admin/subscriptions`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data);
      } else {
        console.error("Failed to fetch", await res.text());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (auth.isAuthenticated) fetchAll();
  }, [auth.isAuthenticated, fetchAll]);

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const approve = async (sub: Subscription) => {
    setActing(sub.id);
    try {
      const token = await auth.getAccessToken();
      const res = await fetch(`${GATEWAY_URL}/admin/subscriptions/${sub.id}/approve`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const updated = await res.json();
        setSubscriptions(prev => prev.map(s => s.id === updated.id ? updated : s));
        showToast(`✅ Approved ${sub.planName} for ${sub.userEmail}`);
      } else {
        showToast(`Failed to approve: ${await res.text()}`, "error");
      }
    } catch (err) {
      showToast("Error approving request", "error");
    } finally {
      setActing(null);
    }
  };

  const reject = async (sub: Subscription) => {
    setActing(sub.id);
    try {
      const token = await auth.getAccessToken();
      const res = await fetch(`${GATEWAY_URL}/admin/subscriptions/${sub.id}/reject`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const updated = await res.json();
        setSubscriptions(prev => prev.map(s => s.id === updated.id ? updated : s));
        showToast(`Rejected ${sub.planName} for ${sub.userEmail}`, "error");
      } else {
        showToast(`Failed to reject: ${await res.text()}`, "error");
      }
    } catch (err) {
      showToast("Error rejecting request", "error");
    } finally {
      setActing(null);
    }
  };

  const isAdmin = (auth.profile as any)?.email === ADMIN_EMAIL;

  if (!auth.isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-lg font-medium text-muted-foreground mb-4">Sign in to access the admin panel.</p>
        <button onClick={() => auth.login()} className="rounded-lg bg-primary text-primary-foreground px-6 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors">Sign in</button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-lg font-medium text-destructive">Access denied — admin only.</p>
      </div>
    );
  }

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
            {" · "}
            <button onClick={fetchAll} className="underline hover:no-underline text-primary">Refresh</button>
          </p>
        </div>
        <div className="flex gap-2">
          {(["pending", "active", "rejected", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
              {f}
              {f === "pending" && pendingCount > 0 && (
                <span className="ml-1 rounded-full bg-white text-primary text-xs px-1">{pendingCount}</span>
              )}
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
            <div key={sub.id} className={`rounded-xl border bg-card p-6 ${sub.status === "pending" ? "border-yellow-300 dark:border-yellow-700" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{sub.planName} Plan</h3>
                    <StatusBadge status={sub.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
                    <div><dt className="text-muted-foreground">Consumer</dt><dd className="font-medium truncate">{sub.userEmail}</dd></div>
                    <div><dt className="text-muted-foreground">Plan</dt><dd className="font-medium capitalize">{sub.planId}</dd></div>
                    <div><dt className="text-muted-foreground">Requested</dt><dd className="font-medium">{new Date(sub.requestedAt).toLocaleDateString()}</dd></div>
                    {sub.resolvedAt && <div><dt className="text-muted-foreground">Resolved</dt><dd className="font-medium">{new Date(sub.resolvedAt).toLocaleDateString()}</dd></div>}
                  </dl>
                  {sub.status === "active" && sub.apiKey && (
                    <div className="mt-3 text-xs text-muted-foreground font-mono truncate">
                      Key: {sub.apiKey.slice(0, 20)}…
                    </div>
                  )}
                </div>
                {sub.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => approve(sub)}
                      disabled={acting === sub.id}
                      className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors"
                    >
                      {acting === sub.id ? "…" : "Approve"}
                    </button>
                    <button
                      onClick={() => reject(sub)}
                      disabled={acting === sub.id}
                      className="rounded-lg border border-destructive/40 text-destructive px-4 py-2 text-sm font-semibold hover:bg-destructive/10 disabled:opacity-60 transition-colors"
                    >
                      {acting === sub.id ? "…" : "Reject"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminPage;
