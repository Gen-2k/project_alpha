import { describe, expect, it } from "vitest";

import { renderAccountDeletedNotification } from "../templates/account-deleted.template.js";
import { escapeHtml, renderEmailLayout } from "../templates/email.layout.js";
import { renderPasswordChangedNotification } from "../templates/password-changed.template.js";
import { renderPasswordResetEmail } from "../templates/password-reset.template.js";
import { renderEmailVerificationEmail } from "../templates/verify-email.template.js";

describe("Email Templates", () => {
  describe("escapeHtml", () => {
    it("should escape special HTML characters to prevent XSS", () => {
      const unsafe = `Ada <Lovelace> & "Babbage" 'test'`;
      const safe = escapeHtml(unsafe);
      expect(safe).toBe("Ada &lt;Lovelace&gt; &amp; &quot;Babbage&quot; &#039;test&#039;");
    });
  });

  describe("renderEmailLayout", () => {
    it("should render minimal layout without optional CTA, callout, or fallbackUrl", () => {
      const html = renderEmailLayout({
        title: "Test Title",
        heading: "Test Heading",
        bodyHtml: "<p>Hello World</p>",
      });

      expect(html).toContain("<title>Test Title</title>");
      expect(html).toContain(">Test Heading</h2>");
      expect(html).toContain("<p>Hello World</p>");
      expect(html).not.toContain("border-left");
      expect(html).not.toContain("If the button above does not work");
    });

    it("should render layout with CTA, warning callout, and fallback URL", () => {
      const html = renderEmailLayout({
        title: "Security Alert",
        heading: "Action Required",
        bodyHtml: "<p>Warning body</p>",
        cta: {
          label: "Fix Now",
          url: "https://example.com/fix",
        },
        callout: {
          type: "warning",
          html: "Immediate action required.",
        },
        fallbackUrl: "https://example.com/fix",
      });

      expect(html).toContain("Fix Now");
      expect(html).toContain("https://example.com/fix");
      expect(html).toContain("border-left: 4px solid #ef4444");
      expect(html).toContain("Immediate action required.");
      expect(html).toContain("If the button above does not work");
    });

    it("should render layout with info callout", () => {
      const html = renderEmailLayout({
        title: "Info Alert",
        heading: "Information",
        bodyHtml: "<p>Info body</p>",
        callout: {
          type: "info",
          html: "Helpful note.",
        },
      });

      expect(html).toContain("border-left: 4px solid #4f46e5");
      expect(html).toContain("Helpful note.");
    });
  });

  describe("renderPasswordResetEmail", () => {
    it("should render password reset email with default 15m expiration", () => {
      const result = renderPasswordResetEmail({
        email: "ada@example.com",
        resetUrl: "https://example.com/reset?token=123",
      });

      expect(result.subject).toBe("Reset your Project Alpha password");
      expect(result.text).toContain("ada@example.com");
      expect(result.text).toContain("https://example.com/reset?token=123");
      expect(result.text).toContain("15 minutes");
      expect(result.html).toContain("Reset Your Password");
      expect(result.html).toContain("ada@example.com");
      expect(result.html).toContain("https://example.com/reset?token=123");
      expect(result.html).toContain("15 minutes");
    });

    it("should respect custom expiration if provided", () => {
      const result = renderPasswordResetEmail({
        email: "ada@example.com",
        resetUrl: "https://example.com/reset?token=123",
        expiresInMinutes: 30,
      });

      expect(result.text).toContain("30 minutes");
      expect(result.html).toContain("30 minutes");
    });
  });

  describe("renderEmailVerificationEmail", () => {
    it("should render email verification email with default 24h expiration", () => {
      const result = renderEmailVerificationEmail({
        email: "ada@example.com",
        verificationUrl: "https://example.com/verify?token=456",
      });

      expect(result.subject).toBe("Verify your Project Alpha email address");
      expect(result.text).toContain("ada@example.com");
      expect(result.text).toContain("https://example.com/verify?token=456");
      expect(result.text).toContain("24 hours");
      expect(result.html).toContain("Verify Your Email Address");
      expect(result.html).toContain("ada@example.com");
      expect(result.html).toContain("https://example.com/verify?token=456");
      expect(result.html).toContain("24 hours");
    });

    it("should respect custom expiration if provided", () => {
      const result = renderEmailVerificationEmail({
        email: "ada@example.com",
        verificationUrl: "https://example.com/verify?token=456",
        expiresInHours: 48,
      });

      expect(result.text).toContain("48 hours");
      expect(result.html).toContain("48 hours");
    });
  });

  describe("renderPasswordChangedNotification", () => {
    it("should render password changed notification", () => {
      const result = renderPasswordChangedNotification({
        email: "ada@example.com",
      });

      expect(result.subject).toBe("Security Alert: Your Project Alpha password was updated");
      expect(result.text).toContain("ada@example.com");
      expect(result.text).toContain("signed out");
      expect(result.html).toContain("Password Updated Successfully");
      expect(result.html).toContain("ada@example.com");
      expect(result.html).toContain("signed out");
    });
  });

  describe("renderAccountDeletedNotification", () => {
    it("should render account deleted notification", () => {
      const result = renderAccountDeletedNotification({
        email: "ada@example.com",
      });

      expect(result.subject).toBe("Your Project Alpha account has been deleted");
      expect(result.text).toContain("ada@example.com");
      expect(result.text).toContain("permanently deleted");
      expect(result.html).toContain("Account Deleted");
      expect(result.html).toContain("ada@example.com");
      expect(result.html).toContain("permanently deleted");
    });
  });
});
