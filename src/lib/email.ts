import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";
import { getContentLanguage } from "./language/config";
import { emailMessages } from "./i18n/server-messages";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    if (!env.email.gmailUser || !env.email.gmailAppPassword) {
      throw new Error(
        "GMAIL_USER/GMAIL_APP_PASSWORD are not configured — see .env.example.",
      );
    }
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.email.gmailUser, pass: env.email.gmailAppPassword },
    });
  }
  return transporter;
}

/**
 * Email with a user's login (email + new password), sent by an admin/manager
 * when creating an account or resetting a password (see /api/users routes).
 * The password only exists in plain text here, in passing — it is never
 * stored. The email is written in the deployment language (APP_LANGUAGE).
 *
 * Via Gmail SMTP: unlike Resend in sandbox mode, there is no "safe" test
 * address — every send is real, to any recipient, even in dev. Testing locally
 * with a real email address, the person really receives it.
 */
export async function sendCredentialsEmail(params: {
  to: string;
  name: string;
  password: string;
}): Promise<{ deliveredTo: string }> {
  const t = emailMessages[getContentLanguage()];
  const loginUrl = `${env.storage.publicBaseUrl.replace(/\/$/, "")}/login`;

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="margin-bottom: 4px;">JornAI</h2>
      <p>${t.greeting(escapeHtml(params.name))}</p>
      <p>${t.intro}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 0; color: #666;">${t.emailLabel}</td>
          <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(params.to)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">${t.passwordLabel}</td>
          <td style="padding: 8px 0; font-weight: 600; font-family: monospace;">${escapeHtml(params.password)}</td>
        </tr>
      </table>
      <p>
        <a href="${loginUrl}" style="display: inline-block; background: #4d7cff; color: #fff; padding: 10px 18px; border-radius: 10px; text-decoration: none; font-weight: 600;">
          ${t.signIn}
        </a>
      </p>
      <p style="color: #666; font-size: 13px;">
        ${t.temporaryNotice}
      </p>
      <p style="color: #888; font-size: 13px; margin-top: 24px;">
        ${t.unexpectedNotice}
      </p>
    </div>
  `;

  await getTransporter().sendMail({
    from: `"JornAI" <${env.email.gmailUser}>`,
    to: params.to,
    subject: t.subject,
    html,
  });

  return { deliveredTo: params.to };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
