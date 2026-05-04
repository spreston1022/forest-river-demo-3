import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

const SUPPORT_EMAIL = "sam@zuplo.com";
const PORTAL_URL = "https://forest-river-demo-main-fb06bf1.zuplo.site";

const PRIORITY_LABELS: Record<number, string> = {
  1: "P1 — Critical",
  2: "P2 — High",
  3: "P3 — Normal",
};

function ticketHtml(subject: string, priority: number, body: string, fromEmail: string): string {
  const priorityColor = priority === 1 ? "#dc2626" : priority === 2 ? "#d97706" : "#2563eb";
  const bodyHtml = body.replace(/\n/g, "<br/>");
  return "<html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px'>"
    + "<div style='background:#026957;padding:24px;margin-bottom:24px'><h1 style='color:#fff;margin:0;font-size:20px'>Forest River Developer Portal — Support Ticket</h1></div>"
    + `<div style='background:#f5f5f5;border-left:4px solid ${priorityColor};padding:16px;margin-bottom:24px'>`
    + `<p style='margin:0 0 4px 0;font-size:12px;color:#666;text-transform:uppercase'>Priority</p>`
    + `<p style='margin:0;font-weight:bold;color:${priorityColor}'>${PRIORITY_LABELS[priority] ?? `P${priority}`}</p></div>`
    + `<h2 style='color:#232323;margin-top:0'>${subject}</h2>`
    + `<p style='font-size:13px;color:#666;margin-bottom:16px'>Submitted by: <strong>${fromEmail}</strong></p>`
    + `<div style='background:#fff;border:1px solid #e2e2e2;border-radius:4px;padding:16px;font-size:14px;line-height:1.6'>${bodyHtml}</div>`
    + "<hr style='border:none;border-top:1px solid #e2e2e2;margin:24px 0'/>"
    + `<p style='font-size:12px;color:#666'>Submitted via <a href='${PORTAL_URL}/support' style='color:#026957'>Forest River Developer Portal</a></p>`
    + "</body></html>";
}

export async function submitTicket(request: ZuploRequest, context: ZuploContext) {
  if (!request.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const body = await request.json() as {
    subject: string;
    priority: number;
    body: string;
    userEmail?: string;
  };

  if (!body.subject?.trim()) {
    return new Response(JSON.stringify({ error: "Subject is required" }), { status: 400 });
  }
  if (![1, 2, 3].includes(body.priority)) {
    return new Response(JSON.stringify({ error: "Priority must be 1, 2, or 3" }), { status: 400 });
  }
  if (!body.body?.trim()) {
    return new Response(JSON.stringify({ error: "Description is required" }), { status: 400 });
  }

  const fromEmail = body.userEmail || (request.user as any).email || request.user.sub;
  const subject = `[Support] [P${body.priority}] ${body.subject.trim()}`;

  const resendKey = environment.RESEND_API_KEY;
  if (!resendKey) {
    context.log.error("RESEND_API_KEY not set");
    return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500 });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Forest River Support <onboarding@resend.dev>",
      to: [SUPPORT_EMAIL],
      reply_to: fromEmail.includes("@") ? fromEmail : undefined,
      subject,
      html: ticketHtml(body.subject.trim(), body.priority, body.body.trim(), fromEmail),
    }),
  });

  if (!res.ok) {
    context.log.error("Resend failed", await res.text());
    return new Response(JSON.stringify({ error: "Failed to send ticket" }), { status: 500 });
  }

  context.log.info(`Support ticket submitted by ${fromEmail}: ${subject}`);
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}
