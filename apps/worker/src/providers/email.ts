import type { WorkerEnv } from "../env.js";
import type { Logger } from "../logger.js";

export interface EmailMessage {
  to: string[];
  subject: string;
  html: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Resend-backed email provider (RS-207 alerts, invites, reports). When no API key
 * is configured it falls back to a logging provider so local/dev runs don't fail —
 * the decision to send still happens, the delivery is just a no-op.
 */
export function getEmailProvider(_env: WorkerEnv, log: Logger): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Rootspun <alerts@rootspun.app>";

  if (!apiKey) {
    return {
      async send(message) {
        log.warn({ to: message.to, subject: message.subject }, "email: no RESEND_API_KEY, not sent");
      },
    };
  }

  return {
    async send(message) {
      if (message.to.length === 0) return;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: message.to, subject: message.subject, html: message.html }),
      });
      if (!res.ok) {
        throw new Error(`resend ${res.status}: ${await res.text()}`);
      }
    },
  };
}
