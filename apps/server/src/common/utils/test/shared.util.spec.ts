import { describe, expect, it } from "vitest";

import { isUniqueViolation, isUuid, requestPathname, slugify } from "../shared.util.js";

describe("shared.util", () => {
  describe("slugify", () => {
    it("should lowercase, trim, and dash-separate names", () => {
      expect(slugify("Hello World")).toBe("hello-world");
      expect(slugify("  Ride_Sharing!! ")).toBe("ride-sharing");
    });

    it("should fall back to a random suffix when the name has no usable characters", () => {
      expect(slugify("!!!", "prod")).toMatch(/^prod-[0-9a-f]{6}$/);
      expect(slugify("ab")).toMatch(/^org-[0-9a-f]{6}$/);
    });
  });

  describe("requestPathname", () => {
    it("should strip query strings that may carry tokens", () => {
      expect(requestPathname("/api/v1/auth/login?token=secret")).toBe("/api/v1/auth/login");
    });

    it("should return root for non-string or empty input", () => {
      expect(requestPathname(undefined)).toBe("/");
      expect(requestPathname("")).toBe("/");
    });
  });

  describe("isUniqueViolation", () => {
    it("should detect Postgres unique-violation errors by code", () => {
      expect(isUniqueViolation(Object.assign(new Error("dup"), { code: "23505" }))).toBe(true);
    });

    it("should reject anything without the violation code", () => {
      expect(isUniqueViolation(new Error("db down"))).toBe(false);
      expect(isUniqueViolation(null)).toBe(false);
      expect(isUniqueViolation({ code: "ECONNREFUSED" })).toBe(false);
    });
  });

  describe("isUuid", () => {
    it("should accept any UUID version shape", () => {
      expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    });

    it("should reject non-UUID strings", () => {
      expect(isUuid("not-a-uuid")).toBe(false);
      expect(isUuid("")).toBe(false);
    });
  });
});
