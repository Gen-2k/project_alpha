import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";

import { renderAccountDeletedNotification } from "./templates/account-deleted.template.js";
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
    const { subject, text, html } = renderPasswordResetEmail({
      email,
      resetUrl,
      expiresInMinutes: 15,
    });

    await this.dispatch({
      to: email,
      subject,
      text,
      html,
      devLogSummary: `[DEV EMAIL DISPATCH] Password reset link for ${email}:\n>>> Reset URL: ${resetUrl}\n>>> Expires in: 15 minutes`,
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
    const { subject, text, html } = renderEmailVerificationEmail({
      email,
      verificationUrl,
      expiresInHours: 24,
    });

    await this.dispatch({
      to: email,
      subject,
      text,
      html,
      devLogSummary: `[DEV EMAIL DISPATCH] Email verification link for ${email}:\n>>> Verification URL: ${verificationUrl}\n>>> Expires in: 24 hours`,
    });
  }
}
