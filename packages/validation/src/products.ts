import { z } from "zod";

export const productNameSchema = z
  .string({ error: "Product name is required" })
  .trim()
  .min(1, "Product name is required")
  .max(100, "Product name must not exceed 100 characters");

export const productSlugSchema = z
  .string({ error: "Slug is required" })
  .trim()
  .toLowerCase()
  .min(3, "Slug must be at least 3 characters long")
  .max(64, "Slug must not exceed 64 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only lowercase alphanumeric characters and single hyphens",
  );

export const productDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Description must not exceed 500 characters")
  .nullish()
  .transform((val) => (val && val.length > 0 ? val : null));

export const createProductSchema = z.object({
  name: productNameSchema,
  slug: productSlugSchema.optional(),
  description: productDescriptionSchema.optional(),
});

export type CreateProductDto = z.input<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    name: productNameSchema.optional(),
    slug: productSlugSchema.optional(),
    description: productDescriptionSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
  });

export type UpdateProductDto = z.infer<typeof updateProductSchema>;

export interface ProductDto {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}
