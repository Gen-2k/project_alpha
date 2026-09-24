import { describe, expect, it } from "vitest";

import { getUuidv7Timestamp, uuidv7 } from "../uuid.js";

describe("UUID v7", () => {
  it("should generate a valid RFC 9562 UUID v7 string format", () => {
    const id = uuidv7();

    // Standard canonical UUID format: 8-4-4-4-12 hex characters
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("should contain version 7 and RFC 4122/9562 variant 1", () => {
    const id = uuidv7();
    const parts = id.split("-");

    // 3rd group starts with '7' (version 7)
    expect(parts[2]?.startsWith("7")).toBe(true);

    // 4th group starts with 8, 9, a, or b (variant 1: binary 10xx)
    const variantChar = parts[3]?.charAt(0).toLowerCase();
    expect(["8", "9", "a", "b"]).toContain(variantChar);
  });

  it("should produce strictly monotonically increasing UUIDs in rapid generation", () => {
    const count = 1000;
    const generated = Array.from({ length: count }, () => uuidv7());

    // Sort lexicographically
    const sorted = [...generated].sort();

    // In a B-Tree index, every subsequent UUID must sort after the previous one
    expect(generated).toEqual(sorted);
  });

  it("should extract embedded millisecond timestamp accurately", () => {
    const before = Date.now();
    const id = uuidv7();
    const after = Date.now();

    const extracted = getUuidv7Timestamp(id);
    const extractedMs = extracted.getTime();

    expect(extractedMs).toBeGreaterThanOrEqual(before);
    expect(extractedMs).toBeLessThanOrEqual(after);
  });
});
