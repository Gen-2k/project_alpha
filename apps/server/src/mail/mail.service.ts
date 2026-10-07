import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";

import { RESET_TOKEN_LIFETIME_MS, VERIFICATION_TOKEN_LIFETIME_MS } from "../auth/auth.types.js";
import { INVITATION_LIFETIME_MS } from "../organizations/organizations.types.js";
import { renderAccountDeletedNotification } from "./templates/account-deleted.template.js";
import { renderMemberAddedNotification } from "./templates/member-added.template.js";
import { renderOrganizationInvitationEmail } from "./templates/organization-invitation.template.js";
import { renderPasswordChangedNotification } from "./templates/password-changed.template.js";
import { renderPasswordResetEmail } from "./templates/password-reset.template.js";
import { renderEmailVerificationEmail } from "./templates/verify-email.template.js";

interface DispatchEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
  devLogSummary: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null = null;
  private readonly frontendUrl: string;
  private readonly emailFrom: string;

  constructor(private readonly config: ConfigService) {
    this.frontendUrl = this.config.get<string>("FRONTEND_URL", "http://localhost:3000");
    this.emailFrom = this.config.get<string>(
      "EMAIL_FROM",
      "Project Alpha <no-reply@projectalpha.local>",
    );

    const smtpHost = this.config.get<string>("SMTP_HOST");
    const smtpUser = this.config.get<string>("SMTP_USER");
    const smtpPass = this.config.get<string>("SMTP_PASS");

    if (smtpHost && smtpUser && smtpPass) {
      const port = this.config.get<number>("SMTP_PORT") ?? 465;
      const secure = this.config.get<boolean>("SMTP_SECURE") ?? port === 465;

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.logger.log(`Initialized SMTP mail transport for host: ${smtpHost}:${String(port)}`);
    } else {
      this.logger.log(
        "No SMTP credentials configured. Running MailService in Console Logger mode.",
      );
    }
  }

  private async dispatch(options: DispatchEmailOptions): Promise<void> {
    if (this.transporter) {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      this.logger.log(`Email delivered via SMTP: "${options.subject}" to ${options.to}`);
    } else {
      this.logger.log(options.devLogSummary);
    }
  }

  async sendPasswordResetEmail(email: string, rawToken: string): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${rawToken}`;
    const expiresInMinutes = RESET_TOKEN_LIFETIME_MS / 60000;
    const { subject, text, html } = renderPasswordResetEmail({
      email,
      resetUrl,
      expiresInMinutes,
    });

    await this.dispatch({
      to: email,
      subject,
      text,
      html,
      devLogSummary: `[DEV EMAIL DISPATCH] Password reset link for ${email}:\n>>> Reset URL: ${resetUrl}\n>>> Expires in: ${String(expiresInMinutes)} minutes`,
    });
  }

  async sendPasswordChangedNotification(email: string): Promise<void> {
    const { subject, text, html } = renderPasswordChangedNotification({ email });

    await this.dispatch({
      to: email,
      subject,
      text,
      html,
      devLogSummary: `[DEV EMAIL DISPATCH] Password changed notification recorded for ${email} (all other sessions signed out)`,
    });
  }

  async sendAccountDeletedNotification(email: string): Promise<void> {
    const { subject, text, html } = renderAccountDeletedNotification({ email });

    await this.dispatch({
      to: email,
      subject,
      text,
      html,
      devLogSummary: `[DEV EMAIL DISPATCH] Account deleted notification recorded for ${email}`,
    });
  }

  async sendEmailVerificationEmail(email: string, rawToken: string): Promise<void> {
    const verificationUrl = `${this.frontendUrl}/verify-email?token=${rawToken}`;
    const expiresInHours = VERIFICATION_TOKEN_LIFETIME_MS / 3600000;
    const { subject, text, html } = renderEmailVerificationEmail({
      email,
      verificationUrl,
      expiresInHours,
    });

    await this.dispatch({
      to: email,
      subject,
      text,
      html,
      devLogSummary: `[DEV EMAIL DISPATCH] Email verification link for ${email}:\n>>> Verification URL: ${verificationUrl}\n>>> Expires in: ${String(expiresInHours)} hours`,
    });
  }

  async sendOrganizationInvitationEmail(
    email: string,
    details: {
      organizationName: string;
      inviterName?: string | null;
      inviterEmail: string;
      role: string;
      rawToken: string;
      expiresInDays?: number;
    },
  ): Promise<void> {
    const inviteUrl = `${this.frontendUrl}/accept-invitation?token=${details.rawToken}`;
    const expiresInDays = details.expiresInDays ?? INVITATION_LIFETIME_MS / 86400000;
    const { subject, text, html } = renderOrganizationInvitationEmail({
      email,
      organizationName: details.organizationName,
      inviterName: details.inviterName,
      inviterEmail: details.inviterEmail,
      role: details.role,
      inviteUrl,
      expiresInDays,
    });

    await this.dispatch({
      to: email,
      subject,
      text,
      html,
      devLogSummary: `[DEV EMAIL DISPATCH] Organization invitation for ${email} to join ${details.organizationName}:\n>>> Invite URL: ${inviteUrl}\n>>> Expires in: ${String(expiresInDays)} days`,
    });
  }

  async sendMemberAddedNotification(
    email: string,
    details: {
      organizationName: string;
      adderName?: string | null;
      role: string;
    },
  ): Promise<void> {
    const dashboardUrl = `${this.frontendUrl}/dashboard`;
    const { subject, text, html } = renderMemberAddedNotification({
      email,
      organizationName: details.organizationName,
      adderName: details.adderName,
      role: details.role,
      dashboardUrl,
    });

    await this.dispatch({
      to: email,
      subject,
      text,
      html,
      devLogSummary: `[DEV EMAIL DISPATCH] Member added notification for ${email} in ${details.organizationName}`,
    });
  }
}
