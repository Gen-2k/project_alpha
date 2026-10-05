import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MailService } from "../mail.service.js";

describe("MailService", () => {
  let configService: ConfigService;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize in logger mode when SMTP config is omitted", async () => {
    configService = new ConfigService({
      FRONTEND_URL: "http://localhost:3000",
      EMAIL_FROM: "Project Alpha <no-reply@projectalpha.local>",
    });

    const mailService = new MailService(configService);
    // Should execute without throwing
    await expect(
      mailService.sendPasswordResetEmail("ada@example.com", "dummy-reset-token-123"),
    ).resolves.toBeUndefined();

    await expect(
      mailService.sendPasswordChangedNotification("ada@example.com"),
    ).resolves.toBeUndefined();

    await expect(
      mailService.sendEmailVerificationEmail("ada@example.com", "dummy-verification-token-123"),
    ).resolves.toBeUndefined();

    await expect(
      mailService.sendAccountDeletedNotification("ada@example.com"),
    ).resolves.toBeUndefined();

    await expect(
      mailService.sendOrganizationInvitationEmail("bob@example.com", {
        organizationName: "Acme Corp",
        inviterName: "Ada Lovelace",
        inviterEmail: "ada@example.com",
        role: "developer",
        rawToken: "inv-token-123",
      }),
    ).resolves.toBeUndefined();

    await expect(
      mailService.sendMemberAddedNotification("bob@example.com", {
        organizationName: "Acme Corp",
        adderName: "Ada Lovelace",
        role: "developer",
      }),
    ).resolves.toBeUndefined();
  });

  it("should initialize SMTP transporter and send emails via nodemailer when configured", async () => {
    const sendMailMock = vi.fn().mockResolvedValue({ messageId: "msg-123" });
    const createTransportSpy = vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: sendMailMock,
    } as unknown as ReturnType<typeof nodemailer.createTransport>);

    configService = new ConfigService({
      FRONTEND_URL: "http://localhost:3000",
      EMAIL_FROM: "Project Alpha <no-reply@projectalpha.local>",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: "smtp_user",
      SMTP_PASS: "smtp_pass",
    });

    const mailService = new MailService(configService);
    expect(createTransportSpy).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: {
        user: "smtp_user",
        pass: "smtp_pass",
      },
    });

    await mailService.sendPasswordResetEmail("ada@example.com", "token-1");
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Project Alpha <no-reply@projectalpha.local>",
        to: "ada@example.com",
        subject: "Reset your Project Alpha password",
      }),
    );

    await mailService.sendPasswordChangedNotification("ada@example.com");
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Project Alpha <no-reply@projectalpha.local>",
        to: "ada@example.com",
        subject: "Security Alert: Your Project Alpha password was updated",
      }),
    );

    await mailService.sendEmailVerificationEmail("ada@example.com", "token-2");
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Project Alpha <no-reply@projectalpha.local>",
        to: "ada@example.com",
        subject: "Verify your Project Alpha email address",
      }),
    );

    await mailService.sendAccountDeletedNotification("ada@example.com");
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Project Alpha <no-reply@projectalpha.local>",
        to: "ada@example.com",
        subject: "Your Project Alpha account has been deleted",
      }),
    );

    await mailService.sendOrganizationInvitationEmail("bob@example.com", {
      organizationName: "Acme Corp",
      inviterName: "Ada Lovelace",
      inviterEmail: "ada@example.com",
      role: "developer",
      rawToken: "inv-token-123",
    });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Project Alpha <no-reply@projectalpha.local>",
        to: "bob@example.com",
        subject: "You've been invited to join Acme Corp on Project Alpha",
      }),
    );

    await mailService.sendMemberAddedNotification("bob@example.com", {
      organizationName: "Acme Corp",
      adderName: "Ada Lovelace",
      role: "developer",
    });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Project Alpha <no-reply@projectalpha.local>",
        to: "bob@example.com",
        subject: "You've been added to Acme Corp on Project Alpha",
      }),
    );
  });

  it("should default SMTP secure to true when port is 465 and SMTP_SECURE is omitted", () => {
    const createTransportSpy = vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: vi.fn(),
    } as unknown as ReturnType<typeof nodemailer.createTransport>);

    configService = new ConfigService({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: 465,
      SMTP_USER: "smtp_user",
      SMTP_PASS: "smtp_pass",
    });

    new MailService(configService);
    expect(createTransportSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 465,
        secure: true,
      }),
    );
  });
});
