import { escapeHtml, renderEmailLayout } from "./email.layout.js";

export interface PasswordResetEmailProps {
  email: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function renderPasswordResetEmail(props: PasswordResetEmailProps): RenderedEmail {
  const expiresInMinutes = props.expiresInMinutes ?? 15;
  const escapedEmail = escapeHtml(props.email);
  const subject = "Reset your Project Alpha password";

  const text = `Hello,\n\nWe received a request to reset the password for your Project Alpha account (${props.email}).\n\nUse the link below to choose a new password:\n${props.resetUrl}\n\nThis link is valid for ${String(expiresInMinutes)} minutes and can only be used once.\n\nIf you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.\n\nBest regards,\nThe Project Alpha Team`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
      We received a request to reset the password for your Project Alpha account (<strong>${escapedEmail}</strong>). Click the button below to set a new password:
    </p>
  `.trim();

  const html = renderEmailLayout({
    title: subject,
    heading: "Reset Your Password",
    bodyHtml,
    cta: {
      label: "Reset Password",
      url: props.resetUrl,
    },
    callout: {
      type: "info",
      html: `<strong>Note:</strong> This link is valid for <strong>${String(expiresInMinutes)} minutes</strong> and can only be used once. If you did not request this, you can safely ignore this email; your account remains secure.`,
    },
    fallbackUrl: props.resetUrl,
  });

  return { subject, text, html };
}
