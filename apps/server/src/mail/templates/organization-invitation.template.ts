import { escapeHtml, renderEmailLayout, sanitizeSubject } from "./email.layout.js";
import type { RenderedEmail } from "./password-reset.template.js";

export interface OrganizationInvitationProps {
  email: string;
  organizationName: string;
  inviterName?: string | null;
  inviterEmail: string;
  role: string;
  inviteUrl: string;
  expiresInDays?: number;
}

export function renderOrganizationInvitationEmail(
  props: OrganizationInvitationProps,
): RenderedEmail {
  const expiresInDays = props.expiresInDays ?? 7;
  const escapedOrg = escapeHtml(props.organizationName);
  const inviterDisplay = props.inviterName
    ? `${props.inviterName} (${props.inviterEmail})`
    : props.inviterEmail;
  const escapedInviter = escapeHtml(inviterDisplay);
  const escapedRole = escapeHtml(props.role);
  const subject = sanitizeSubject(
    `You've been invited to join ${props.organizationName} on Project Alpha`,
  );

  const text = `Hello,\n\n${inviterDisplay} has invited you to join ${props.organizationName} as a ${props.role} on Project Alpha.\n\nPlease accept your invitation by clicking the link below:\n${props.inviteUrl}\n\nThis invitation link will expire in ${String(expiresInDays)} days.\n\nIf you were not expecting this invitation, you can safely ignore this email.\n\nBest regards,\nThe Project Alpha Team`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
      <strong>${escapedInviter}</strong> has invited you to join <strong>${escapedOrg}</strong> as a <strong>${escapedRole}</strong> on Project Alpha.
    </p>
  `.trim();

  const html = renderEmailLayout({
    title: subject,
    heading: "Join Your Team on Project Alpha",
    bodyHtml,
    cta: {
      label: "Accept Invitation",
      url: props.inviteUrl,
    },
    callout: {
      type: "info",
      html: `<strong>Note:</strong> This invitation is valid for <strong>${String(expiresInDays)} days</strong>. Click the button above to accept and join the workspace.`,
    },
    fallbackUrl: props.inviteUrl,
  });

  return { subject, text, html };
}
