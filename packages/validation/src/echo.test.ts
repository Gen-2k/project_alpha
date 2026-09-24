import { describe, expect, it } from "vitest";

import { echoSchema } from "./echo.js";

describe("echoSchema", () => {
  it("accepts a non-empty message within limits", () => {
    expect(echoSchema.safeParse({ message: "hello" }).success).toBe(true);
  });

  it("rejects empty, missing, and oversized messages", () => {
    expect(echoSchema.safeParse({ message: "" }).success).toBe(false);
    expect(echoSchema.safeParse({}).success).toBe(false);
    expect(echoSchema.safeParse({ message: "x".repeat(281) }).success).toBe(false);
  });
});
