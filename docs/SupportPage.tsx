import { useState } from "react";
import { useAuth, useZudoku } from "zudoku/hooks";

const GATEWAY_URL = import.meta.env.ZUPLO_PUBLIC_SERVER_URL ?? "https://forest-river-demo-main-fb06bf1.zuplo.app";

const PRIORITIES = [
  { value: 1, label: "P1 — Critical", description: "Service is down or completely unusable", color: "border-red-400 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300" },
  { value: 2, label: "P2 — High",     description: "Major feature broken, significant impact", color: "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  { value: 3, label: "P3 — Normal",   description: "Question, minor issue, or general request", color: "border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300" },
];

export function SupportPage() {
  const auth = useAuth();
  const { authentication } = useZudoku();

  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<number>(3);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const userEmail = (auth.profile as any)?.email ?? "";

  const handleSubmit = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const req = new Request(`${GATEWAY_URL}/support/ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), priority, body: body.trim(), userEmail }),
      });
      const signed = await authentication?.signRequest(req);
      const res = await fetch(signed ?? req);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as any).error ?? "Failed to submit ticket. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="rounded-xl border border-dashed p-12">
          <h1 className="text-2xl font-bold mb-2">Developer Support</h1>
          <p className="text-muted-foreground mb-6">Sign in to submit a support ticket. Our team typically responds within one business day.</p>
          <button
            onClick={() => auth.login()}
            className="rounded-lg bg-primary text-primary-foreground px-6 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Sign in to continue
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="rounded-xl border border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950 p-12">
          <p className="text-4xl mb-4">✅</p>
          <h2 className="text-xl font-bold text-green-800 dark:text-green-300 mb-2">Ticket submitted</h2>
          <p className="text-sm text-green-700 dark:text-green-400 mb-6">
            We received your request and will follow up at <strong>{userEmail}</strong>. Expect a response within one business day.
          </p>
          <button
            onClick={() => { setSubmitted(false); setSubject(""); setBody(""); setPriority(3); }}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Submit another ticket
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Developer Support</h1>
        <p className="text-muted-foreground">
          Submitting as <strong>{userEmail}</strong>. We'll reply to this address.
        </p>
      </div>

      <div className="space-y-6">
        {/* Priority */}
        <div>
          <label className="block text-sm font-medium mb-2">Priority <span className="text-destructive">*</span></label>
          <div className="space-y-2">
            {PRIORITIES.map(p => (
              <label key={p.value} className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${priority === p.value ? p.color : "border-border hover:bg-muted"}`}>
                <input
                  type="radio"
                  name="priority"
                  value={p.value}
                  checked={priority === p.value}
                  onChange={() => setPriority(p.value)}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-sm font-semibold">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium mb-1">Subject <span className="text-destructive">*</span></label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. Authentication failing with valid API key"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium mb-1">Description <span className="text-destructive">*</span></label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Describe the issue, including steps to reproduce, relevant request/response details, and any error messages."
            rows={7}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <p className="mt-1 text-xs text-muted-foreground">{body.length} characters</p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!subject.trim() || !body.trim() || submitting}
          className="w-full rounded-lg bg-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {submitting ? "Submitting…" : "Submit ticket"}
        </button>
      </div>
    </div>
  );
}

export default SupportPage;
