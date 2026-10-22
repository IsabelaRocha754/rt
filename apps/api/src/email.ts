import type { Env } from "./env.js";

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

// Minimal Resend REST client via a plain fetch call — avoids adding the
// `resend` package (CLAUDE.md rule 9: ask before adding a dependency) for
// what is a single POST request.
async function sendEmail(env: Env, input: SendEmailInput): Promise<void> {
  if (!env.EMAIL_API_KEY) {
    // Local/dev/test only — env.ts requires EMAIL_API_KEY in production, so
    // this branch never runs there. Logs only the subject, never the link.
    console.info(`[email stub] would send "${input.subject}" to ${input.to}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.EMAIL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send email (status ${response.status}).`);
  }
}

export function sendVerificationEmail(env: Env, to: string, url: string): Promise<void> {
  return sendEmail(env, {
    to,
    subject: "Verify your email",
    text: `Click the link below to verify your email address:\n\n${url}`,
  });
}

export function sendPasswordResetEmail(env: Env, to: string, url: string): Promise<void> {
  return sendEmail(env, {
    to,
    subject: "Reset your password",
    text: `Click the link below to reset your password:\n\n${url}`,
  });
}
