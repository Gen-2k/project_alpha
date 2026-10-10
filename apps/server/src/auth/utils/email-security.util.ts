import type { MxRecord } from "node:dns";
import * as dns from "node:dns/promises";

// RFC 2606 reserved domains and TLDs for testing and documentation.
// These automatically bypass live DNS resolution so local development, CI,
// and automated test runners work offline without network dependencies.
const RESERVED_DOMAINS = new Set(["example.com", "example.net", "example.org"]);
const RESERVED_TLDS = [".example", ".invalid", ".localhost", ".test"];

// Curated high-volume disposable and temporary throwaway email domains.
// In-memory Set provides O(1) lookups with zero external network overhead.
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "burnermail.io",
  "crazymailing.com",
  "dispostable.com",
  "dropmail.me",
  "fakeinbox.com",
  "getairmail.com",
  "getnada.com",
  "guerrillamail.biz",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "inboxkitten.com",
  "mailcatch.com",
  "maildrop.cc",
  "mailinator.com",
  "minuteinbox.com",
  "mohmal.com",
  "mytemp.email",
  "nada.ltd",
  "sharklasers.com",
  "temp-mail.org",
  "tempail.com",
  "tempmail.com",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.net",
  "yopmail.com",
  "yopmail.net",
]);

export interface DnsResolverInterface {
  resolveMx(hostname: string): Promise<MxRecord[]>;
  resolve4(hostname: string): Promise<string[]>;
  resolve6?(hostname: string): Promise<string[]>;
}

export interface CheckEmailDomainOptions {
  timeoutMs?: number;
  dnsResolver?: DnsResolverInterface;
}

/**
 * Checks if the given email domain is configured to receive emails.
 * Performs an MX record resolution with fallback to A/AAAA address resolution (RFC 5321).
 * RFC 2606 reserved domains automatically pass to allow offline test execution.
 */
export async function checkEmailDomain(
  domainOrEmail: string,
  options: CheckEmailDomainOptions = {},
): Promise<boolean> {
  const domain = extractDomain(domainOrEmail);
  if (!domain) return false;

  // RFC 2606 test domain bypass
  if (isReservedTestDomain(domain)) {
    return true;
  }

  const resolver = options.dnsResolver ?? dns;
  const timeoutMs = options.timeoutMs ?? 2500;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("DNS_TIMEOUT"));
      }, timeoutMs);
      timer.unref();
    });

    const mxLookup = async (): Promise<boolean> => {
      try {
        const mxRecords = await resolver.resolveMx(domain);
        if (mxRecords.length > 0) {
          // RFC 7505 Null MX record check: exchange "." or "" means domain explicitly rejects mail
          const hasValidExchange = mxRecords.some(
            (rec) => rec.exchange !== "." && rec.exchange !== "",
          );
          return hasValidExchange;
        }
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        // If not found or no MX data, fallback to A/AAAA records per RFC 5321 Section 5.1
        if (code !== "ENODATA" && code !== "ENOTFOUND") {
          return false;
        }
      }

      // RFC 5321 fallback: check for address records (A for IPv4, AAAA for IPv6)
      try {
        const aRecords = await resolver.resolve4(domain);
        if (Array.isArray(aRecords) && aRecords.length > 0) {
          return true;
        }
      } catch {
        // Fall back to IPv6 resolution below
      }

      try {
        const aaaaRecords = await resolver.resolve6?.(domain);
        return Array.isArray(aaaaRecords) && aaaaRecords.length > 0;
      } catch {
        return false;
      }
    };

    return await Promise.race([mxLookup(), timeoutPromise]);
  } catch {
    // On DNS timeout or resolution timeout, fail open to avoid denying legitimate signups during external DNS latency
    return true;
  }
}

/**
 * Checks whether an email belongs to a known temporary/disposable email provider.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = extractDomain(email);
  if (!domain) return false;
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

/**
 * Normalizes an email address according to provider-specific rules.
 * When `enabled` is false, it preserves aliases (+tags) and dots for testing.
 * When `enabled` is true:
 * - Gmail/Googlemail: strips dots and +alias tags, canonicalizes domain to gmail.com.
 * - Outlook/Hotmail/Live: strips +alias tags, preserves dots.
 */
export function normalizeEmail(email: string, enabled = false): string {
  const trimmed = email.trim().toLowerCase();
  if (!enabled) {
    return trimmed;
  }

  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return trimmed;
  }

  const localPart = trimmed.slice(0, atIndex);
  let domain = trimmed.slice(atIndex + 1);

  if (domain === "googlemail.com") {
    domain = "gmail.com";
  }

  if (domain === "gmail.com") {
    // [0] types as string|undefined under noUncheckedIndexedAccess, so the
    // fallback stays for the type system even though split() never yields an
    // empty array at runtime (that side is uncoverable by construction).
    const withoutPlus = localPart.split("+")[0] ?? "";
    const withoutDots = withoutPlus.replace(/\./g, "");
    return `${withoutDots}@${domain}`;
  }

  if (domain === "outlook.com" || domain === "hotmail.com" || domain === "live.com") {
    const withoutPlus = localPart.split("+")[0] ?? "";
    return `${withoutPlus}@${domain}`;
  }

  return `${localPart}@${domain}`;
}

function extractDomain(domainOrEmail: string): string {
  const trimmed = domainOrEmail.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  return atIndex >= 0 ? trimmed.slice(atIndex + 1) : trimmed;
}

function isReservedTestDomain(domain: string): boolean {
  if (RESERVED_DOMAINS.has(domain)) return true;
  return RESERVED_TLDS.some((tld) => domain.endsWith(tld));
}
