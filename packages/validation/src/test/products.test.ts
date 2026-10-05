import {
  createProductSchema,
  productDescriptionSchema,
  productNameSchema,
  productSlugSchema,
  updateProductSchema,
} from "@repo/validation/products";
import { describe, expect, it } from "vitest";

describe("productNameSchema", () => {
  it("accepts valid product names and trims whitespace", () => {
    const result = productNameSchema.safeParse("  Ride Sharing  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("Ride Sharing");
    }
  });

  it("rejects empty names or names exceeding 100 characters", () => {
    expect(productNameSchema.safeParse("").success).toBe(false);
    expect(productNameSchema.safeParse("   ").success).toBe(false);
    expect(productNameSchema.safeParse("a".repeat(101)).success).toBe(false);
  });
});

describe("productSlugSchema", () => {
  it("accepts valid URL-safe slugs and lowercases them", () => {
    const result = productSlugSchema.safeParse("  Ride-Sharing  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("ride-sharing");
    }
  });

  it("rejects invalid slugs", () => {
    expect(productSlugSchema.safeParse("ab").success).toBe(false);
    expect(productSlugSchema.safeParse("-leading").success).toBe(false);
    expect(productSlugSchema.safeParse("trailing-").success).toBe(false);
    expect(productSlugSchema.safeParse("double--dash").success).toBe(false);
    expect(productSlugSchema.safeParse("has spaces").success).toBe(false);
  });
});

describe("productDescriptionSchema", () => {
  it("transforms empty string to null and trims whitespace", () => {
    const emptyResult = productDescriptionSchema.safeParse("");
    expect(emptyResult.success).toBe(true);
    if (emptyResult.success) {
      expect(emptyResult.data).toBeNull();
    }

    const validResult = productDescriptionSchema.safeParse("  Consumer ride booking apps  ");
    expect(validResult.success).toBe(true);
    if (validResult.success) {
      expect(validResult.data).toBe("Consumer ride booking apps");
    }
  });
});

describe("createProductSchema", () => {
  it("accepts valid product with minimal fields", () => {
    const result = createProductSchema.safeParse({ name: "Ride Sharing" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Ride Sharing");
      expect(result.data.slug).toBeUndefined();
    }
  });

  it("accepts valid product with explicit slug and description", () => {
    const result = createProductSchema.safeParse({
      name: "Ride Sharing",
      slug: "ride-sharing",
      description: "Mobility product group",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe("ride-sharing");
      expect(result.data.description).toBe("Mobility product group");
    }
  });

  it("rejects invalid payload", () => {
    expect(createProductSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createProductSchema.safeParse({}).success).toBe(false);
  });
});

describe("updateProductSchema", () => {
  it("accepts partial updates", () => {
    expect(updateProductSchema.safeParse({ name: "Updated Product" }).success).toBe(true);
    expect(updateProductSchema.safeParse({ description: "New description" }).success).toBe(true);
  });

  it("rejects empty object", () => {
    expect(updateProductSchema.safeParse({}).success).toBe(false);
  });
});
