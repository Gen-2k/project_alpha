import type { MxRecord } from "node:dns";

import { describe, expect, it } from "vitest";

import type { DnsResolverInterface } from "../utils/email-security.util.js";
import {
  checkEmailDomain,
  isDisposableEmail,
  normalizeEmail,
} from "../utils/email-security.util.js";

describe("email-security.util", () => {
  describe("isDisposableEmail", () => {
    it("should detect known disposable email providers", () => {
      expect(isDisposableEmail("attacker@mailinator.com")).toBe(true);
      expect(isDisposableEmail("user@10minutemail.com")).toBe(true);
      expect(isDisposableEmail("test@tempmail.com")).toBe(true);
      expect(isDisposableEmail("spammer@guerrillamail.com")).toBe(true);
      expect(isDisposableEmail("fake@sharklasers.com")).toBe(true);
      expect(isDisposableEmail("anon@yopmail.com")).toBe(true);
    });

    it("should accept legitimate email providers", () => {
      expect(isDisposableEmail("user@gmail.com")).toBe(false);
      expect(isDisposableEmail("user@outlook.com")).toBe(false);
      expect(isDisposableEmail("user@example.com")).toBe(false);
      expect(isDisposableEmail("corporate@company.org")).toBe(false);
    });

    it("should return false for malformed or empty domain", () => {
      expect(isDisposableEmail("")).toBe(false);
    });
  });

  describe("normalizeEmail", () => {
    describe("when normalization is disabled (enabled = false)", () => {
      it("should preserve dots and +tags exactly for testing", () => {
        expect(normalizeEmail("John.Doe+tag@gmail.com", false)).toBe("john.doe+tag@gmail.com");
        expect(normalizeEmail("Test.User+alias1@example.com", false)).toBe(
          "test.user+alias1@example.com",
        );
        expect(normalizeEmail("   user+1@domain.com   ", false)).toBe("user+1@domain.com");
      });
    });

    describe("when normalization is enabled (enabled = true)", () => {
      it("should strip dots and plus tags for Gmail and Googlemail", () => {
        expect(normalizeEmail("john.doe+spam@gmail.com", true)).toBe("johndoe@gmail.com");
        expect(normalizeEmail("j.o.h.n.d.o.e@gmail.com", true)).toBe("johndoe@gmail.com");
        expect(normalizeEmail("john.doe+test@googlemail.com", true)).toBe("johndoe@gmail.com");
      });

      it("should strip plus tags but preserve dots for Outlook and Hotmail", () => {
        expect(normalizeEmail("john.doe+newsletter@outlook.com", true)).toBe(
          "john.doe@outlook.com",
        );
        expect(normalizeEmail("alice.smith+promo@hotmail.com", true)).toBe(
          "alice.smith@hotmail.com",
        );
        expect(normalizeEmail("user+tag@live.com", true)).toBe("user@live.com");
      });

      it("should keep tags and dots for non-specialized email domains", () => {
        expect(normalizeEmail("developer+test@protonmail.com", true)).toBe(
          "developer+test@protonmail.com",
        );
        expect(normalizeEmail("first.last+sub@company.internal", true)).toBe(
          "first.last+sub@company.internal",
        );
      });

      it("should safely handle strings without valid @ separator", () => {
        expect(normalizeEmail("invalid-email-string", true)).toBe("invalid-email-string");
        expect(normalizeEmail("@invalid", true)).toBe("@invalid");
        expect(normalizeEmail("user@", true)).toBe("user@");
      });
    });
  });

  describe("checkEmailDomain", () => {
    it("should automatically allow RFC 2606 reserved domains without DNS queries", async () => {
      expect(await checkEmailDomain("test@example.com")).toBe(true);
      expect(await checkEmailDomain("test@example.org")).toBe(true);
      expect(await checkEmailDomain("user@host.invalid")).toBe(true);
      expect(await checkEmailDomain("user@app.test")).toBe(true);
      expect(await checkEmailDomain("user@service.localhost")).toBe(true);
    });

    it("should return false when domain is missing or empty", async () => {
      expect(await checkEmailDomain("")).toBe(false);
    });

    it("should resolve domain with valid MX record", async () => {
      const mockResolver: DnsResolverInterface = {
        resolveMx: () => Promise.resolve([{ exchange: "mail.company.com", priority: 10 }]),
        resolve4: () => Promise.resolve(["1.2.3.4"]),
      };

      const result = await checkEmailDomain("user@company.com", { dnsResolver: mockResolver });
      expect(result).toBe(true);
    });

    it("should reject domain with RFC 7505 Null MX record (exchange = '.')", async () => {
      const mockResolver: DnsResolverInterface = {
        resolveMx: () => Promise.resolve([{ exchange: ".", priority: 0 }]),
        resolve4: () => Promise.resolve([]),
      };

      const result = await checkEmailDomain("user@nomail.com", { dnsResolver: mockResolver });
      expect(result).toBe(false);
    });

    it("should reject domain with empty-string Null MX exchange", async () => {
      const mockResolver: DnsResolverInterface = {
        resolveMx: () => Promise.resolve([{ exchange: "", priority: 0 }]),
        resolve4: () => Promise.resolve([]),
      };

      const result = await checkEmailDomain("user@nomail2.com", { dnsResolver: mockResolver });
      expect(result).toBe(false);
    });

    it("should fall back to A records when MX returns an empty list", async () => {
      const mockResolver: DnsResolverInterface = {
        resolveMx: () => Promise.resolve([]),
        resolve4: () => Promise.resolve(["192.0.2.5"]),
      };

      const result = await checkEmailDomain("user@mxless-domain.com", {
        dnsResolver: mockResolver,
      });
      expect(result).toBe(true);
    });

    it("should fall back to A record resolution when MX returns ENODATA (RFC 5321)", async () => {
      const mockResolver: DnsResolverInterface = {
        resolveMx: () => {
          const err = new Error("ENODATA");
          (err as { code?: string }).code = "ENODATA";
          return Promise.reject(err);
        },
        resolve4: () => Promise.resolve(["192.0.2.1"]),
      };

      const result = await checkEmailDomain("user@a-only-domain.com", {
        dnsResolver: mockResolver,
      });
      expect(result).toBe(true);
    });

    it("should fall back to A record when MX returns ENOTFOUND", async () => {
      const mockResolver: DnsResolverInterface = {
        resolveMx: () => {
          const err = new Error("ENOTFOUND");
          (err as { code?: string }).code = "ENOTFOUND";
          return Promise.reject(err);
        },
        resolve4: () => Promise.resolve(["192.0.2.2"]),
      };

      const result = await checkEmailDomain("user@domain.com", { dnsResolver: mockResolver });
      expect(result).toBe(true);
    });

    it("should return false when both MX and A records fail and resolve6 is undefined", async () => {
      const mockResolver: DnsResolverInterface = {
        resolveMx: () => {
          const err = new Error("ENOTFOUND");
          (err as { code?: string }).code = "ENOTFOUND";
          return Promise.reject(err);
        },
        resolve4: () => Promise.reject(new Error("ENOTFOUND")),
      };

      const result = await checkEmailDomain("user@nonexistent-fake-domain.xyz", {
        dnsResolver: mockResolver,
      });
      expect(result).toBe(false);
    });

    it("should fall back to AAAA (IPv6) record when MX and A records fail (RFC 5321)", async () => {
      const mockResolver: DnsResolverInterface = {
        resolveMx: () => {
          const err = new Error("ENOTFOUND");
          (err as { code?: string }).code = "ENOTFOUND";
          return Promise.reject(err);
        },
        resolve4: () => Promise.reject(new Error("ENOTFOUND")),
        resolve6: () => Promise.resolve(["2001:db8::1"]),
      };

      const result = await checkEmailDomain("user@ipv6-domain.com", {
        dnsResolver: mockResolver,
      });
      expect(result).toBe(true);
    });

    it("should return false when MX, A, and AAAA records all fail", async () => {
      const mockResolver: DnsResolverInterface = {
        resolveMx: () => {
          const err = new Error("ENOTFOUND");
          (err as { code?: string }).code = "ENOTFOUND";
          return Promise.reject(err);
        },
        resolve4: () => Promise.reject(new Error("ENOTFOUND")),
        resolve6: () => Promise.reject(new Error("ENOTFOUND")),
      };

      const result = await checkEmailDomain("user@completely-dead.xyz", {
        dnsResolver: mockResolver,
      });
      expect(result).toBe(false);
    });

    it("should return false on hard DNS resolution error other than ENODATA/ENOTFOUND", async () => {
      const mockResolver: DnsResolverInterface = {
        resolveMx: () => {
          const err = new Error("EREFUSED");
          (err as { code?: string }).code = "EREFUSED";
          return Promise.reject(err);
        },
        resolve4: () => Promise.resolve([]),
      };

      const result = await checkEmailDomain("user@refused.com", { dnsResolver: mockResolver });
      expect(result).toBe(false);
    });

    it("should fail open and return true when DNS query times out", async () => {
      const mockResolver: DnsResolverInterface = {
        resolveMx: () => new Promise<MxRecord[]>((resolve) => setTimeout(() => resolve([]), 500)),
        resolve4: () => Promise.resolve([]),
      };

      const result = await checkEmailDomain("user@slowdns.com", {
        dnsResolver: mockResolver,
        timeoutMs: 10,
      });
      expect(result).toBe(true);
    });

    it("should return false when unexpected error occurs during resolution", async () => {
      const mockResolver: DnsResolverInterface = {
        resolveMx: () => {
          throw new Error("UNEXPECTED_SYSTEM_FAULT");
        },
        resolve4: () => Promise.resolve([]),
      };

      const result = await checkEmailDomain("user@crash.com", {
        dnsResolver: mockResolver,
      });
      expect(result).toBe(false);
    });
  });
});
