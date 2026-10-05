import { z } from "zod";

export const projectNameSchema = z
  .string({ error: "Project name is required" })
  .trim()
  .min(1, "Project name is required")
  .max(100, "Project name must not exceed 100 characters");

export const projectSlugSchema = z
  .string({ error: "Slug is required" })
  .trim()
  .toLowerCase()
  .min(3, "Slug must be at least 3 characters long")
  .max(64, "Slug must not exceed 64 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only lowercase alphanumeric characters and single hyphens",
  );

export const productNameSchema = z
  .string()
  .trim()
  .max(100, "Product name must not exceed 100 characters")
  .nullish()
  .transform((val) => (val && val.length > 0 ? val : null));

export const projectDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Description must not exceed 500 characters")
  .nullish()
  .transform((val) => (val && val.length > 0 ? val : null));

// BCP 47 language tag (e.g. "en-US", "es-ES", "ja-JP", "de-DE")
export const languageTagSchema = z
  .string({ error: "Language tag is required" })
  .trim()
  .max(35, "Language tag must not exceed 35 characters")
  .regex(
    /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]+)*$/,
    "Please provide a valid BCP 47 language tag (e.g. en-US)",
  );

export const createProjectSchema = z.object({
  name: projectNameSchema,
  slug: projectSlugSchema.optional(),
  productId: z.uuid().optional(),
  productName: productNameSchema.optional(),
  description: projectDescriptionSchema.optional(),
  sourceLanguage: languageTagSchema.default("en-US"),
  targetLanguages: z
    .array(languageTagSchema)
    .default([])
    .transform((tags) => Array.from(new Set(tags))),
});

export type CreateProjectDto = z.input<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: projectNameSchema.optional(),
    slug: projectSlugSchema.optional(),
    productId: z.uuid().nullish(),
    productName: productNameSchema.optional(),
    description: projectDescriptionSchema.optional(),
    sourceLanguage: languageTagSchema.optional(),
    targetLanguages: z
      .array(languageTagSchema)
      .transform((tags) => Array.from(new Set(tags)))
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
  });

export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;

export const listProjectsQuerySchema = z.object({
  productId: z.uuid().optional(),
  productName: z.string().trim().max(100).optional(),
});

export type ListProjectsQueryDto = z.infer<typeof listProjectsQuerySchema>;

// Outward DTO interfaces
export interface ProjectProductSummaryDto {
  id: string;
  name: string;
  slug: string;
}

export interface ProjectDto {
  id: string;
  organizationId: string;
  productId: string | null;
  product: ProjectProductSummaryDto | null;
  name: string;
  slug: string;
  description: string | null;
  sourceLanguage: string;
  targetLanguages: string[];
  createdAt: Date;
  updatedAt: Date;
}
