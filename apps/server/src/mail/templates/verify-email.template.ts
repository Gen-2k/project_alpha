import { escapeHtml, renderEmailLayout } from "./email.layout.js";
import type { RenderedEmail } from "./password-reset.template.js";

export interface EmailVerificationProps {
  email: string;
  verificationUrl: string;
  expiresInHours?: number;
}

export function renderEmailVerificationEmail(props: EmailVerificationProps): RenderedEmail {
  const expiresInHours = props.expiresInHours ?? 24;
  const escapedEmail = escapeHtml(props.email);
  const subject = "Verify your Project Alpha email address";

  const text = `Hello,\n\nThank you for registering with Project Alpha!\n\nPlease verify your email address (${props.email}) by clicking the link below:\n${props.verificationUrl}\n\nThis link is valid for ${String(expiresInHours)} hours. Once verified, you will be able to log in to your account.\n\nIf you did not create an account, you can safely ignore this email.\n\nBest regards,\nThe Project Alpha Team`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
      Welcome to Project Alpha! Please confirm that <strong>${escapedEmail}</strong> is your email address by clicking the button below:
    </p>
  `.trim();

  const html = renderEmailLayout({
    title: subject,
    heading: "Verify Your Email Address",
    bodyHtml,
    cta: {
      label: "Verify Email Address",
      url: props.verificationUrl,
    },
    callout: {
      type: "info",
      html: `<strong>Note:</strong> This link is valid for <strong>${String(expiresInHours)} hours</strong>. After verifying, you will be redirected to the login page to sign in with your password.`,
    },
    fallbackUrl: props.verificationUrl,
  });

  return { subject, text, html };
}
