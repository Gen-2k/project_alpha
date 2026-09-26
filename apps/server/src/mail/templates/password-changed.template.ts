import { escapeHtml, renderEmailLayout } from "./email.layout.js";
import type { RenderedEmail } from "./password-reset.template.js";

export interface PasswordChangedNotificationProps {
  email: string;
}

export function renderPasswordChangedNotification(
  props: PasswordChangedNotificationProps,
): RenderedEmail {
  const escapedEmail = escapeHtml(props.email);
  const subject = "Security Alert: Your Project Alpha password was updated";

  const text = `Hello,\n\nThe password for your Project Alpha account (${props.email}) was recently updated.\n\nAll other active device sessions have been automatically signed out to keep your account secure.\n\nIf you did not initiate this change, please reset your password immediately and contact support.\n\nBest regards,\nThe Project Alpha Team`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
      This is a confirmation that the password for your Project Alpha account (<strong>${escapedEmail}</strong>) was recently updated.
    </p>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 22px; color: #475569;">
      All other active device sessions have been signed out to maintain your account security.
    </p>
  `.trim();

  const html = renderEmailLayout({
    title: subject,
    heading: "Password Updated Successfully",
    bodyHtml,
    callout: {
      type: "warning",
      html: "If you did not make this change, your account may be compromised. Please reset your password immediately or contact support.",
    },
  });

  return { subject, text, html };
}
