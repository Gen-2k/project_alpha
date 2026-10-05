import {
  createProjectSchema,
  languageTagSchema,
  listProjectsQuerySchema,
  productNameSchema,
  projectDescriptionSchema,
  projectNameSchema,
  projectSlugSchema,
  updateProjectSchema,
} from "@repo/validation/projects";
import { describe, expect, it } from "vitest";

describe("projectNameSchema", () => {
  it("accepts valid project names and trims whitespace", () => {
    const result = projectNameSchema.safeParse("  iOS Mobile App  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("iOS Mobile App");
    }
  });

  it("rejects empty names or names exceeding 100 characters", () => {
    expect(projectNameSchema.safeParse("").success).toBe(false);
    expect(projectNameSchema.safeParse("   ").success).toBe(false);
    expect(projectNameSchema.safeParse("a".repeat(101)).success).toBe(false);
  });
});

describe("projectSlugSchema", () => {
  it("accepts valid URL-safe slugs and lowercases them", () => {
    const result = projectSlugSchema.safeParse("  Mobile-App  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("mobile-app");
    }
  });

  it("rejects invalid slugs", () => {
    expect(projectSlugSchema.safeParse("ab").success).toBe(false);
    expect(projectSlugSchema.safeParse("-leading").success).toBe(false);
    expect(projectSlugSchema.safeParse("trailing-").success).toBe(false);
    expect(projectSlugSchema.safeParse("double--dash").success).toBe(false);
    expect(projectSlugSchema.safeParse("has spaces").success).toBe(false);
  });
});

describe("productNameSchema", () => {
  it("transforms empty string to null and trims whitespace", () => {
    const emptyResult = productNameSchema.safeParse("");
    expect(emptyResult.success).toBe(true);
    if (emptyResult.success) {
      expect(emptyResult.data).toBeNull();
    }

    const validResult = productNameSchema.safeParse("  Ride Sharing  ");
    expect(validResult.success).toBe(true);
    if (validResult.success) {
      expect(validResult.data).toBe("Ride Sharing");
    }
  });
});

describe("projectDescriptionSchema", () => {
  it("transforms empty string or null to null and trims whitespace", () => {
    const emptyResult = projectDescriptionSchema.safeParse("");
    expect(emptyResult.success).toBe(true);
    if (emptyResult.success) {
      expect(emptyResult.data).toBeNull();
    }

    const nullResult = projectDescriptionSchema.safeParse(null);
    expect(nullResult.success).toBe(true);
    if (nullResult.success) {
      expect(nullResult.data).toBeNull();
    }

    const validResult = projectDescriptionSchema.safeParse("  A valid project description  ");
    expect(validResult.success).toBe(true);
    if (validResult.success) {
      expect(validResult.data).toBe("A valid project description");
    }
  });

  it("rejects descriptions exceeding 500 characters", () => {
    expect(projectDescriptionSchema.safeParse("a".repeat(501)).success).toBe(false);
  });
});

describe("languageTagSchema", () => {
  it("accepts valid BCP 47 tags", () => {
    expect(languageTagSchema.safeParse("en-US").success).toBe(true);
    expect(languageTagSchema.safeParse("es").success).toBe(true);
    expect(languageTagSchema.safeParse("ja-JP").success).toBe(true);
    expect(languageTagSchema.safeParse("zh-Hans-CN").success).toBe(true);
  });

  it("rejects invalid tags", () => {
    expect(languageTagSchema.safeParse("invalid tag with spaces").success).toBe(false);
    expect(languageTagSchema.safeParse("").success).toBe(false);
    expect(languageTagSchema.safeParse("x").success).toBe(false);
  });
});

describe("createProjectSchema", () => {
  it("accepts valid project with defaults", () => {
    const result = createProjectSchema.safeParse({
      name: "Mobile App",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Mobile App");
      expect(result.data.sourceLanguage).toBe("en-US");
      expect(result.data.targetLanguages).toEqual([]);
      expect(result.data.slug).toBeUndefined();
    }
  });

  it("accepts full payload with custom slug, product, and languages", () => {
    const result = createProjectSchema.safeParse({
      name: "Mobile App",
      slug: "mobile-app",
      productName: "Ride Sharing",
      description: "iOS and Android localization targets",
      sourceLanguage: "en-US",
      targetLanguages: ["es-ES", "ja-JP", "de-DE"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe("mobile-app");
      expect(result.data.productName).toBe("Ride Sharing");
      expect(result.data.targetLanguages).toHaveLength(3);
    }
  });

  it("accepts valid productId UUID", () => {
    const validUuid = "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9030";
    const result = createProjectSchema.safeParse({
      name: "Mobile App",
      productId: validUuid,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.productId).toBe(validUuid);
    }
  });

  it("rejects invalid productId UUID", () => {
    const result = createProjectSchema.safeParse({
      name: "Mobile App",
      productId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("deduplicates redundant target languages", () => {
    const result = createProjectSchema.safeParse({
      name: "Mobile App",
      targetLanguages: ["es-ES", "ja-JP", "es-ES", "ja-JP"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetLanguages).toEqual(["es-ES", "ja-JP"]);
    }
  });

  it("rejects invalid payload", () => {
    expect(createProjectSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createProjectSchema.safeParse({}).success).toBe(false);
  });
});

describe("updateProjectSchema", () => {
  it("accepts partial updates", () => {
    expect(updateProjectSchema.safeParse({ name: "Updated Name" }).success).toBe(true);
    expect(updateProjectSchema.safeParse({ targetLanguages: ["es-ES", "fr-FR"] }).success).toBe(
      true,
    );
  });

  it("deduplicates redundant target languages in updates", () => {
    const result = updateProjectSchema.safeParse({
      targetLanguages: ["es-ES", "fr-FR", "es-ES"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetLanguages).toEqual(["es-ES", "fr-FR"]);
    }
  });

  it("rejects empty object", () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
  });
});

describe("listProjectsQuerySchema", () => {
  it("accepts empty object or valid productName", () => {
    expect(listProjectsQuerySchema.safeParse({}).success).toBe(true);
    const parsed = listProjectsQuerySchema.safeParse({ productName: " Mobile App " });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.productName).toBe("Mobile App");
    }
  });
});
