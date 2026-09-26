import { escapeHtml, renderEmailLayout } from "./email.layout.js";
import type { RenderedEmail } from "./password-reset.template.js";

export interface AccountDeletedNotificationProps {
  email: string;
}

export function renderAccountDeletedNotification(
  props: AccountDeletedNotificationProps,
): RenderedEmail {
  const escapedEmail = escapeHtml(props.email);
  const subject = "Your Project Alpha account has been deleted";

  const text = `Hello,\n\nThis is a confirmation that your Project Alpha account (${props.email}) has been permanently deleted along with all associated data and active sessions.\n\nIf you did not request this deletion, please contact support immediately.\n\nBest regards,\nThe Project Alpha Team`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
      This is a confirmation that your Project Alpha account (<strong>${escapedEmail}</strong>) has been permanently deleted along with all associated data and active sessions.
    </p>
  `.trim();

  const html = renderEmailLayout({
    title: subject,
    heading: "Account Deleted",
    bodyHtml,
    callout: {
      type: "warning",
      html: "If you did not request this deletion, please contact support immediately.",
    },
  });

  return { subject, text, html };
}
