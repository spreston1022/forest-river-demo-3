import { useState, useEffect, useCallback } from "react";
import { useAuth, useZudoku } from "zudoku/hooks";

const GATEWAY_URL = import.meta.env.ZUPLO_PUBLIC_SERVER_URL ?? "https://forest-river-demo-main-fb06bf1.zuplo.app";

interface MaintenanceState {
  enabled: boolean;
  message: string;
  enabledAt?: string;
}

interface Subscription {
  id: string; planId: string; planName: string;
  userId: string; userEmail: string; companyName: string;
  dealerId: string; useCase: string; expectedVolume: string;
  webhookUrl: string; tosAccepted: boolean; tosAcceptedAt: string;
  status: "pending" | "active" | "rejected" | "suspended";
  apiKey?: string; requestedAt: string; resolvedAt?: string;
  portalMessage?: string; portalMessageType?: "info" | "warning" | "success";
}

const PLANS = [
  { id: "basic", name: "Basic", rateLimit: "100 req/min", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
  { id: "pro", name: "Pro", rateLimit: "15 req/min", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" },
  { id: "enterprise", name: "Enterprise", rateLimit: "Unlimited", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
];

type TabType = "requests" | "groups" | "announcements";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    suspended: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[status] || ""}`}>{status}</span>;
}

function PlanBadge({ planId }: { planId: string }) {
  const plan = PLANS.find(p => p.id === planId);
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${plan?.color || ""}`}>{plan?.name ?? planId}</span>;
}

interface RevokeModalState {
  sub: Subscription;
  step: "choose" | "roll" | "offboard";
}

function RevokeModal({
  state,
  acting,
  onClose,
  onSuspend,
  onRollKey,
  onOffboard,
  onStepChange,
}: {
  state: RevokeModalState;
  acting: string | null;
  onClose: () => void;
  onSuspend: (sub: Subscription) => void;
  onRollKey: (sub: Subscription, hours: number) => void;
  onOffboard: (sub: Subscription) => void;
  onStepChange: (step: "choose" | "roll" | "offboard") => void;
}) {
  const { sub, step } = state;
  const [gracePeriodHours, setGracePeriodHours] = useState(24);
  const isActing = acting === sub.id;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl border shadow-xl w-full max-w-lg">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">
              {step === "choose" && `Revoke Access — ${sub.companyName || sub.userEmail}`}
              {step === "roll" && "Roll API Key"}
              {step === "offboard" && "Full Offboard"}
            </h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
          </div>

          {step === "choose" && (
            <div className="space-y-3">
              <div className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sm">Suspend</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Block API access immediately. Reversible — dealer can be reinstated.</p>
                  </div>
                  <button
                    onClick={() => { onSuspend(sub); onClose(); }}
                    disabled={isActing}
                    className="shrink-0 rounded-lg border border-orange-400 text-orange-700 hover:bg-orange-50 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
                  >
                    {isActing ? "…" : "Suspend"}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sm">Roll Key</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Issue a new key with a grace period. Old key stays valid until expiry.</p>
                  </div>
                  <button
                    onClick={() => onStepChange("roll")}
                    className="shrink-0 rounded-lg border border-primary text-primary hover:bg-primary/10 px-3 py-1.5 text-xs font-medium transition-colors"
                  >
                    Roll Key →
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-red-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sm text-destructive">Full Offboard</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Permanently delete the consumer and all API keys. Irreversible.</p>
                  </div>
                  <button
                    onClick={() => onStepChange("offboard")}
                    className="shrink-0 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 px-3 py-1.5 text-xs font-medium transition-colors"
                  >
                    Offboard →
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "roll" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A new API key will be issued for <strong>{sub.companyName || sub.userEmail}</strong>. Their old key remains valid for the grace period below, then is automatically deleted.
              </p>

              <div>
                <p className="text-sm font-medium mb-2">Grace period for old key:</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 4, 12, 24, 48, 72].map(h => (
                    <label key={h} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm cursor-pointer transition-colors ${gracePeriodHours === h ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted"}`}>
                      <input
                        type="radio"
                        name="gracePeriod"
                        value={h}
                        checked={gracePeriodHours === h}
                        onChange={() => setGracePeriodHours(h)}
                        className="sr-only"
                      />
                      {h}h
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => onStepChange("choose")} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Back</button>
                <button
                  onClick={() => onRollKey(sub, gracePeriodHours)}
                  disabled={isActing}
                  className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {isActing ? "Rolling…" : `Roll Key (${gracePeriodHours}h grace)`}
                </button>
              </div>
            </div>
          )}

          {step === "offboard" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950 p-4 text-sm text-red-800 dark:text-red-300">
                ⚠️ This action is permanent. The consumer and ALL their API keys will be deleted.
              </div>
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950 p-4 text-sm text-amber-800 dark:text-amber-300">
                Note: the dealer's Auth0 portal session remains valid until their JWT expires (up to 24h). In production, also call Auth0's token revocation endpoint for immediate session termination.
              </div>
              <div className="flex gap-3">
                <button onClick={() => onStepChange("choose")} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                <button
                  onClick={() => onOffboard(sub)}
                  disabled={isActing}
                  className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors"
                >
                  {isActing ? "Offboarding…" : "Confirm Full Offboard"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminPage() {
  const auth = useAuth();
  const { authentication } = useZudoku();
  const [tab, setTab] = useState<TabType>("requests");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "rejected" | "suspended">("pending");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [movingPlan, setMovingPlan] = useState<Record<string, string>>({});
  const [revokeModal, setRevokeModal] = useState<RevokeModalState | null>(null);

  // Kill switch state
  const [maintenanceState, setMaintenanceState] = useState<MaintenanceState | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);

  // Announcement state
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementTarget, setAnnouncementTarget] = useState<"all" | "basic" | "pro" | "enterprise">("all");
  const [announcementType, setAnnouncementType] = useState<"info" | "warning" | "success">("info");
  const [publishing, setPublishing] = useState(false);

  // Email state
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailTarget, setEmailTarget] = useState<"all" | "basic" | "pro" | "enterprise">("all");
  const [sendingEmail, setSendingEmail] = useState(false);

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

  const fetchMaintenance = useCallback(async () => {
    if (!auth.isAuthenticated) return;
    try {
      const res = await authFetch(`${GATEWAY_URL}/admin/maintenance`);
      if (res.ok) setMaintenanceState(await res.json());
    } catch { /* ignore */ }
  }, [auth.isAuthenticated, authFetch]);

  const toggleMaintenance = async (enable: boolean) => {
    const confirmMsg = enable
      ? "Enable maintenance mode? All dealer API traffic will immediately receive a 503. Propagates within ~30 seconds."
      : "Restore traffic? All dealer API requests will resume immediately.";
    if (!confirm(confirmMsg)) return;
    setTogglingMaintenance(true);
    try {
      const res = await authFetch(`${GATEWAY_URL}/admin/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: enable, message: enable ? maintenanceMessage : "" }),
      });
      if (res.ok) {
        const state: MaintenanceState = await res.json();
        setMaintenanceState(state);
        if (!enable) setMaintenanceMessage("");
        showToast(enable ? "🔴 Maintenance mode enabled — traffic is blocked" : "✅ Traffic restored", enable ? "error" : "success");
      } else {
        showToast(`Failed: ${await res.text()}`, "error");
      }
    } catch { showToast("Error toggling maintenance mode", "error"); }
    finally { setTogglingMaintenance(false); }
  };

  useEffect(() => { if (auth.isAuthenticated) fetchAll(); }, [auth.isAuthenticated, fetchAll]);
  useEffect(() => { if (auth.isAuthenticated) fetchMaintenance(); }, [auth.isAuthenticated, fetchMaintenance]);
  useEffect(() => { const i = setInterval(fetchAll, 10000); return () => clearInterval(i); }, [fetchAll]);
  useEffect(() => { const i = setInterval(fetchMaintenance, 30000); return () => clearInterval(i); }, [fetchMaintenance]);

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

  const suspend = async (sub: Subscription) => {
    setActing(sub.id);
    try {
      const res = await authFetch(`${GATEWAY_URL}/admin/subscriptions/${sub.id}/suspend`, { method: "POST" });
      if (res.ok) { const u = await res.json(); setSubscriptions(prev => prev.map(s => s.id === u.id ? u : s)); showToast(`⏸️ Suspended ${sub.companyName || sub.userEmail}`); }
      else showToast(`Failed: ${await res.text()}`, "error");
    } catch { showToast("Error suspending", "error"); }
    finally { setActing(null); }
  };

  const reinstate = async (sub: Subscription) => {
    setActing(sub.id);
    try {
      const res = await authFetch(`${GATEWAY_URL}/admin/subscriptions/${sub.id}/reinstate`, { method: "POST" });
      if (res.ok) { const u = await res.json(); setSubscriptions(prev => prev.map(s => s.id === u.id ? u : s)); showToast(`✅ Reinstated ${sub.companyName || sub.userEmail}`); }
      else showToast(`Failed: ${await res.text()}`, "error");
    } catch { showToast("Error reinstating", "error"); }
    finally { setActing(null); }
  };

  const rollKey = async (sub: Subscription, gracePeriodHours: number) => {
    setActing(sub.id);
    try {
      const res = await authFetch(`${GATEWAY_URL}/admin/subscriptions/${sub.id}/roll-key`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gracePeriodHours }),
      });
      if (res.ok) {
        const u = await res.json();
        setSubscriptions(prev => prev.map(s => s.id === sub.id ? u : s));
        showToast(`🔑 Key rolled for ${sub.companyName || sub.userEmail} — old key expires in ${gracePeriodHours}h`);
        setRevokeModal(null);
      } else showToast(`Failed: ${await res.text()}`, "error");
    } catch { showToast("Error rolling key", "error"); }
    finally { setActing(null); }
  };

  const offboard = async (sub: Subscription) => {
    setActing(sub.id);
    try {
      const res = await authFetch(`${GATEWAY_URL}/admin/subscriptions/${sub.id}`, { method: "DELETE" });
      if (res.ok) {
        setSubscriptions(prev => prev.filter(s => s.id !== sub.id));
        showToast(`🗑️ ${sub.companyName || sub.userEmail} fully offboarded`);
        setRevokeModal(null);
      } else showToast(`Failed: ${await res.text()}`, "error");
    } catch { showToast("Error offboarding", "error"); }
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

  const publishAnnouncement = async () => {
    if (!announcementMessage.trim()) return;
    setPublishing(true);
    try {
      const res = await authFetch(`${GATEWAY_URL}/admin/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: announcementMessage,
          target: announcementTarget,
          type: announcementType,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        showToast(`✅ Announcement published to ${result.updated} consumer${result.updated !== 1 ? "s" : ""}`);
        setAnnouncementMessage("");
        await fetchAll();
      } else {
        showToast(`Failed: ${await res.text()}`, "error");
      }
    } catch { showToast("Error publishing announcement", "error"); }
    finally { setPublishing(false); }
  };

  const clearAnnouncements = async (target: string) => {
    setPublishing(true);
    try {
      const res = await authFetch(`${GATEWAY_URL}/admin/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "", target, type: "info" }),
      });
      if (res.ok) {
        showToast(`✅ Announcements cleared for ${target === "all" ? "all consumers" : target + " plan"}`);
        await fetchAll();
      }
    } catch { showToast("Error clearing announcements", "error"); }
    finally { setPublishing(false); }
  };

  const sendEmail = async () => {
    if (!emailSubject.trim() || !emailMessage.trim()) return;
    setSendingEmail(true);
    try {
      const res = await authFetch(`${GATEWAY_URL}/admin/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: emailSubject,
          message: emailMessage,
          target: emailTarget,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        showToast(`✅ Email sent to ${result.sent} consumer${result.sent !== 1 ? "s" : ""}`);
        setEmailSubject("");
        setEmailMessage("");
      } else {
        showToast(`Failed: ${await res.text()}`, "error");
      }
    } catch { showToast("Error sending email", "error"); }
    finally { setSendingEmail(false); }
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
  const suspendedCount = subscriptions.filter(s => s.status === "suspended").length;
  const activeByPlan = PLANS.map(plan => ({
    ...plan,
    members: subscriptions.filter(s => s.status === "active" && s.planId === plan.id),
  }));

  const withAnnouncements = subscriptions.filter(s => s.portalMessage).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-white shadow-lg text-sm ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`} style={{ maxWidth: 400 }}>
          {toast.message}
        </div>
      )}

      {revokeModal && (
        <RevokeModal
          state={revokeModal}
          acting={acting}
          onClose={() => setRevokeModal(null)}
          onSuspend={suspend}
          onRollKey={rollKey}
          onOffboard={offboard}
          onStepChange={step => setRevokeModal(prev => prev ? { ...prev, step } : null)}
        />
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          {pendingCount > 0 && <span className="text-yellow-600 dark:text-yellow-400 font-medium">{pendingCount} pending · </span>}
          {activeCount} active consumers
          {suspendedCount > 0 && <span className="text-orange-600 dark:text-orange-400"> · {suspendedCount} suspended</span>}
          {withAnnouncements > 0 && <span className="text-blue-600 dark:text-blue-400"> · {withAnnouncements} with active announcements</span>}
          {" · "}<button onClick={fetchAll} className="underline hover:no-underline text-primary">Refresh</button>
        </p>
      </div>

      {/* Kill Switch */}
      <div className={`rounded-xl border p-6 mb-8 transition-colors ${maintenanceState?.enabled ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950" : "border-border bg-card"}`}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 mb-0.5">
              API Kill Switch
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${maintenanceState == null ? "bg-muted text-muted-foreground" : maintenanceState.enabled ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"}`}>
                {maintenanceState == null ? "Loading…" : maintenanceState.enabled ? "🔴 MAINTENANCE" : "🟢 LIVE"}
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              {maintenanceState?.enabled
                ? `All consumer API traffic is blocked — returning 503.${maintenanceState.enabledAt ? ` Active since ${new Date(maintenanceState.enabledAt).toLocaleTimeString()}.` : ""}`
                : "API is operating normally. Toggle to immediately block all dealer traffic."}
            </p>
          </div>
        </div>

        {maintenanceState?.enabled && maintenanceState.message && (
          <div className="rounded-lg border border-red-300 bg-red-100 dark:border-red-700 dark:bg-red-900 px-3 py-2 text-sm text-red-800 dark:text-red-200 mb-4 font-mono">
            "{maintenanceState.message}"
          </div>
        )}

        {!maintenanceState?.enabled && (
          <div className="mb-4 max-w-xl">
            <label className="block text-sm font-medium mb-1">
              Custom 503 message <span className="text-muted-foreground font-normal text-xs">(optional — shown in API responses)</span>
            </label>
            <input
              type="text"
              value={maintenanceMessage}
              onChange={e => setMaintenanceMessage(e.target.value)}
              placeholder="The Forest River API is currently undergoing scheduled maintenance. Please try again later."
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          {maintenanceState?.enabled ? (
            <button
              onClick={() => toggleMaintenance(false)}
              disabled={togglingMaintenance}
              className="rounded-lg bg-green-600 text-white px-6 py-2 text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              {togglingMaintenance ? "Restoring…" : "✅ Restore Traffic"}
            </button>
          ) : (
            <button
              onClick={() => toggleMaintenance(true)}
              disabled={togglingMaintenance || maintenanceState == null}
              className="rounded-lg bg-red-600 text-white px-6 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {togglingMaintenance ? "Enabling…" : "🔴 Enable Maintenance Mode"}
            </button>
          )}
          <p className="text-xs text-muted-foreground">Propagates to all edge nodes within ~30 seconds</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 rounded-lg border p-1 w-fit bg-muted">
        {([
          { id: "requests", label: "Subscription Requests", badge: pendingCount > 0 ? pendingCount : null },
          { id: "groups", label: "Group Management", badge: null },
          { id: "announcements", label: "Announcements", badge: withAnnouncements > 0 ? withAnnouncements : null },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`rounded-md px-5 py-1.5 text-sm font-medium transition-colors ${tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
            {t.badge && <span className={`ml-2 rounded-full text-white text-xs px-1.5 py-0.5 ${t.id === "requests" ? "bg-yellow-500" : "bg-blue-500"}`}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ── REQUESTS TAB ── */}
      {tab === "requests" && (
        <div>
          <div className="flex gap-2 mb-6">
            {(["pending", "active", "suspended", "rejected", "all"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
                {f}{f === "pending" && pendingCount > 0 && <span className="ml-1 rounded-full bg-white text-primary text-xs px-1">{pendingCount}</span>}
                {f === "suspended" && suspendedCount > 0 && <span className="ml-1 rounded-full bg-white text-orange-700 text-xs px-1">{suspendedCount}</span>}
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
                <div key={sub.id} className={`rounded-xl border bg-card overflow-hidden ${
                  sub.status === "pending" ? "border-yellow-300 dark:border-yellow-700" :
                  sub.status === "suspended" ? "border-orange-300 dark:border-orange-700" : ""
                }`}>
                  <div className="flex items-start justify-between gap-4 p-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-lg">{sub.companyName || sub.userEmail}</h3>
                        <StatusBadge status={sub.status} />
                        <PlanBadge planId={sub.planId} />
                        {sub.portalMessage && <span className="rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 text-xs font-medium">📢 Has announcement</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
                        <div><span className="text-muted-foreground">Email: </span><span className="font-medium">{sub.userEmail}</span></div>
                        {sub.dealerId && <div><span className="text-muted-foreground">Dealer ID: </span><span className="font-medium">{sub.dealerId}</span></div>}
                        {sub.useCase && <div><span className="text-muted-foreground">Use case: </span><span className="font-medium">{sub.useCase}</span></div>}
                        <div><span className="text-muted-foreground">Requested: </span><span className="font-medium">{new Date(sub.requestedAt).toLocaleDateString()}</span></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
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
                      {sub.status === "active" && (
                        <button onClick={() => setRevokeModal({ sub, step: "choose" })}
                          className="rounded-lg border border-orange-400 text-orange-700 hover:bg-orange-50 px-4 py-2 text-sm font-semibold transition-colors">
                          Revoke →
                        </button>
                      )}
                      {sub.status === "suspended" && (
                        <button onClick={() => reinstate(sub)} disabled={acting === sub.id}
                          className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors">
                          {acting === sub.id ? "…" : "Reinstate"}
                        </button>
                      )}
                    </div>
                  </div>

                  {expanded === sub.id && (
                    <div className="border-t bg-muted/30 px-6 py-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                        {sub.expectedVolume && <div><p className="text-muted-foreground text-xs mb-0.5">Expected Volume</p><p className="font-medium">{sub.expectedVolume}</p></div>}
                        {sub.webhookUrl && <div><p className="text-muted-foreground text-xs mb-0.5">Webhook</p><p className="font-medium truncate text-xs font-mono">{sub.webhookUrl}</p></div>}
                        {sub.resolvedAt && <div><p className="text-muted-foreground text-xs mb-0.5">Resolved</p><p className="font-medium">{new Date(sub.resolvedAt).toLocaleDateString()}</p></div>}
                      </div>
                      <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${sub.tosAccepted ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300"}`}>
                        <span>{sub.tosAccepted ? "✅" : "❌"}</span>
                        <span>{sub.tosAccepted ? `ToS accepted${sub.tosAcceptedAt ? ` on ${new Date(sub.tosAcceptedAt).toLocaleString()}` : ""}` : "Terms of Service not accepted"}</span>
                      </div>
                      {sub.portalMessage && (
                        <div className="rounded-lg bg-blue-50 dark:bg-blue-950 px-3 py-2 text-sm">
                          <p className="text-xs text-muted-foreground mb-0.5">Active announcement</p>
                          <p className="text-blue-800 dark:text-blue-300">{sub.portalMessage}</p>
                        </div>
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
                            {sub.portalMessage && <span className="text-xs text-blue-600 dark:text-blue-400">· 📢 announcement active</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{sub.userEmail}{sub.useCase ? ` · ${sub.useCase}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">Move to:</span>
                          <select
                            value={movingPlan[sub.id] ?? sub.planId}
                            onChange={e => setMovingPlan(prev => ({ ...prev, [sub.id]: e.target.value }))}
                            className="rounded-lg border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {PLANS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <button
                            onClick={() => moveToGroup(sub, movingPlan[sub.id] ?? sub.planId)}
                            disabled={acting === sub.id || (movingPlan[sub.id] ?? sub.planId) === sub.planId}
                            className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
                          >
                            {acting === sub.id ? "…" : "Apply"}
                          </button>
                          <button
                            onClick={() => setRevokeModal({ sub, step: "choose" })}
                            className="rounded-lg border border-orange-400 text-orange-700 hover:bg-orange-50 px-3 py-1.5 text-xs font-medium transition-colors"
                          >
                            Revoke →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Suspended consumers section */}
          {suspendedCount > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">Suspended</span>
                <h2 className="font-semibold">Suspended Consumers</h2>
              </div>
              <div className="space-y-2">
                {subscriptions.filter(s => s.status === "suspended").map(sub => (
                  <div key={sub.id} className="rounded-xl border border-orange-300 dark:border-orange-700 bg-card p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium">{sub.companyName || sub.userEmail}</p>
                        <PlanBadge planId={sub.planId} />
                      </div>
                      <p className="text-xs text-muted-foreground">{sub.userEmail}</p>
                    </div>
                    <button
                      onClick={() => reinstate(sub)}
                      disabled={acting === sub.id}
                      className="shrink-0 rounded-lg bg-green-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors"
                    >
                      {acting === sub.id ? "…" : "Reinstate"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ANNOUNCEMENTS TAB ── */}
      {tab === "announcements" && (
        <div>
          <p className="text-sm text-muted-foreground mb-6">
            Publish targeted announcements to consumers in the developer portal. Messages appear in their My Subscriptions view until dismissed.
          </p>

          {/* Message composer */}
          <div className="rounded-xl border bg-card p-6 mb-8">
            <h2 className="font-semibold text-lg mb-4">Publish Announcement</h2>

            <div className="space-y-4">
              {/* Target group */}
              <div>
                <label className="block text-sm font-medium mb-1">Target Group</label>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { id: "all", label: "All Consumers" },
                    { id: "basic", label: "Basic" },
                    { id: "pro", label: "Pro" },
                    { id: "enterprise", label: "Enterprise" },
                  ] as const).map(t => (
                    <button key={t.id} onClick={() => setAnnouncementTarget(t.id)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${announcementTarget === t.id ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
                      {t.label}
                      {t.id !== "all" && (
                        <span className="ml-1.5 text-xs opacity-70">
                          ({activeByPlan.find(p => p.id === t.id)?.members.length ?? 0})
                        </span>
                      )}
                      {t.id === "all" && (
                        <span className="ml-1.5 text-xs opacity-70">({activeCount})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message type */}
              <div>
                <label className="block text-sm font-medium mb-1">Message Type</label>
                <div className="flex gap-2">
                  {([
                    { id: "info", label: "ℹ️ Info", color: "border-blue-300 bg-blue-50 text-blue-800" },
                    { id: "warning", label: "⚠️ Warning", color: "border-yellow-300 bg-yellow-50 text-yellow-800" },
                    { id: "success", label: "✅ Success", color: "border-green-300 bg-green-50 text-green-800" },
                  ] as const).map(t => (
                    <button key={t.id} onClick={() => setAnnouncementType(t.id)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${announcementType === t.id ? t.color : "border-border hover:bg-muted"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message text */}
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea
                  value={announcementMessage}
                  onChange={e => setAnnouncementMessage(e.target.value)}
                  placeholder="e.g. Pro plan rate limits are increasing to 50 req/min on June 1. No action needed."
                  rows={3}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <p className="mt-1 text-xs text-muted-foreground">{announcementMessage.length} characters</p>
              </div>

              {/* Preview */}
              {announcementMessage.trim() && (
                <div>
                  <label className="block text-sm font-medium mb-1">Preview</label>
                  <div className={`rounded-lg border p-3 text-sm ${
                    announcementType === "warning" ? "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" :
                    announcementType === "success" ? "border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-300" :
                    "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <p>{announcementMessage}</p>
                      <span className="text-xs opacity-50 shrink-0">✕ dismiss</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={publishAnnouncement}
                  disabled={!announcementMessage.trim() || publishing}
                  className="rounded-lg bg-primary text-primary-foreground px-6 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {publishing ? "Publishing…" : `Publish to ${announcementTarget === "all" ? "All Consumers" : announcementTarget.charAt(0).toUpperCase() + announcementTarget.slice(1)}`}
                </button>
                {announcementMessage && (
                  <button onClick={() => setAnnouncementMessage("")}
                    className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Email composer */}
          <div className="rounded-xl border bg-card p-6 mb-8">
            <h2 className="font-semibold text-lg mb-1">Send Email</h2>
            <p className="text-sm text-muted-foreground mb-4">Send a direct email to consumers in a plan group via Resend.</p>

            <div className="space-y-4">
              {/* Target */}
              <div>
                <label className="block text-sm font-medium mb-1">Target Group</label>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { id: "all", label: "All Consumers" },
                    { id: "basic", label: "Basic" },
                    { id: "pro", label: "Pro" },
                    { id: "enterprise", label: "Enterprise" },
                  ] as const).map(t => (
                    <button key={t.id} onClick={() => setEmailTarget(t.id)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${emailTarget === t.id ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
                      {t.label}
                      <span className="ml-1.5 text-xs opacity-70">
                        ({t.id === "all" ? activeCount : (activeByPlan.find(p => p.id === t.id)?.members.length ?? 0)})
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="e.g. Important update to your Forest River API access"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea
                  value={emailMessage}
                  onChange={e => setEmailMessage(e.target.value)}
                  placeholder="Write your message here. Plain text or simple HTML supported."
                  rows={5}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex gap-3 items-center">
                <button
                  onClick={sendEmail}
                  disabled={!emailSubject.trim() || !emailMessage.trim() || sendingEmail}
                  className="rounded-lg bg-primary text-primary-foreground px-6 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {sendingEmail ? "Sending…" : `Send to ${emailTarget === "all" ? "All Consumers" : emailTarget.charAt(0).toUpperCase() + emailTarget.slice(1)}`}
                </button>
                {(emailSubject || emailMessage) && (
                  <button onClick={() => { setEmailSubject(""); setEmailMessage(""); }}
                    className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
                    Clear
                  </button>
                )}
                <p className="text-xs text-muted-foreground">Emails delivered via Resend · Forest River branding applied automatically</p>
              </div>
            </div>
          </div>

          {/* Active announcements */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Active Announcements</h2>
              {withAnnouncements > 0 && (
                <button onClick={() => clearAnnouncements("all")} disabled={publishing}
                  className="rounded-lg border border-destructive/40 text-destructive px-3 py-1.5 text-xs font-medium hover:bg-destructive/10 transition-colors disabled:opacity-60">
                  Clear All
                </button>
              )}
            </div>

            {withAnnouncements === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
                No active announcements
              </div>
            ) : (
              <div className="space-y-2">
                {subscriptions.filter(s => s.portalMessage).map(sub => (
                  <div key={sub.id} className="rounded-xl border bg-card p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{sub.companyName || sub.userEmail}</p>
                        <PlanBadge planId={sub.planId} />
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{sub.portalMessage}</p>
                    </div>
                    <button
                      onClick={async () => {
                        setActing(sub.id);
                        try {
                          const res = await authFetch(`${GATEWAY_URL}/admin/subscriptions/${sub.id}/announce`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ message: "", type: "info" }),
                          });
                          if (res.ok) {
                            setSubscriptions(prev => prev.map(s => s.id === sub.id ? { ...s, portalMessage: "" } : s));
                            showToast("Announcement cleared");
                          }
                        } catch { showToast("Error clearing", "error"); }
                        finally { setActing(null); }
                      }}
                      disabled={acting === sub.id}
                      className="shrink-0 rounded-lg border border-destructive/40 text-destructive px-3 py-1.5 text-xs font-medium hover:bg-destructive/10 disabled:opacity-60 transition-colors"
                    >
                      {acting === sub.id ? "…" : "Clear"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
