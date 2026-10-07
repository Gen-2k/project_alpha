import { escapeHtml, renderEmailLayout, sanitizeSubject } from "./email.layout.js";
import type { RenderedEmail } from "./password-reset.template.js";

export interface MemberAddedNotificationProps {
  email: string;
  organizationName: string;
  adderName?: string | null;
  role: string;
  dashboardUrl: string;
}

export function renderMemberAddedNotification(props: MemberAddedNotificationProps): RenderedEmail {
  const escapedOrg = escapeHtml(props.organizationName);
  const adderDisplay = props.adderName ? escapeHtml(props.adderName) : "An administrator";
  const escapedRole = escapeHtml(props.role);
  const subject = sanitizeSubject(
    `You've been added to ${props.organizationName} on Project Alpha`,
  );

  const text = `Hello,\n\n${props.adderName ?? "An administrator"} has added you to ${props.organizationName} as a ${props.role} on Project Alpha.\n\nYou can access the workspace right now using the link below:\n${props.dashboardUrl}\n\nBest regards,\nThe Project Alpha Team`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
      <strong>${adderDisplay}</strong> has added you to <strong>${escapedOrg}</strong> with the role of <strong>${escapedRole}</strong>.
    </p>
  `.trim();

  const html = renderEmailLayout({
    title: subject,
    heading: "You've Been Added to a Team",
    bodyHtml,
    cta: {
      label: "Go to Organization",
      url: props.dashboardUrl,
    },
    callout: {
      type: "info",
      html: `You have direct access to projects and resources in <strong>${escapedOrg}</strong> based on your <strong>${escapedRole}</strong> permissions.`,
    },
    fallbackUrl: props.dashboardUrl,
  });

  return { subject, text, html };
}
