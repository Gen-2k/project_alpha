import { randomBytes } from "node:crypto";

import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Db } from "@repo/database/client";
import { DB } from "@repo/database/client";
import { products } from "@repo/database/schema";
import type { CreateProductDto, ProductDto, UpdateProductDto } from "@repo/validation/products";
import { and, asc, eq, sql } from "drizzle-orm";

import { isUniqueViolation, slugify } from "../common/utils/shared.util.js";

const safeProductColumns = {
  id: products.id,
  organizationId: products.organizationId,
  name: products.name,
  slug: products.slug,
  description: products.description,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
};

@Injectable()
export class ProductsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findOrCreateByName(organizationId: string, name: string): Promise<ProductDto> {
    const trimmed = name.trim();
    const lowerName = trimmed.toLowerCase();

    // 1. Case-insensitive lookup to prevent duplicate fragmentation
    const existing = await this.findByLowerName(organizationId, lowerName);
    if (existing) {
      return existing;
    }

    // 2. Atomic creation if not found
    let slug = slugify(trimmed, "prod");
    try {
      const [created] = await this.db
        .insert(products)
        .values({
          organizationId,
          name: trimmed,
          slug,
          description: null,
        })
        .returning(safeProductColumns);

      if (!created) {
        throw new Error("Failed to create product record");
      }
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) {
        // A concurrent insert may have won the race between our lookup and
        // our insert: re-check first, otherwise two same-named products
        // fragment. Only a genuinely different name gets a suffixed slug.
        const raced = await this.findByLowerName(organizationId, lowerName);
        if (raced) {
          return raced;
        }
        slug = `${slug}-${randomBytes(2).toString("hex")}`;
        const [retried] = await this.db
          .insert(products)
          .values({
            organizationId,
            name: trimmed,
            slug,
            description: null,
          })
          .returning(safeProductColumns);

        if (!retried) {
          throw new Error("Failed to create product record after slug collision retry");
        }
        return retried;
      }
      throw error;
    }
  }

  private async findByLowerName(
    organizationId: string,
    lowerName: string,
  ): Promise<ProductDto | undefined> {
    const [row] = await this.db
      .select(safeProductColumns)
      .from(products)
      .where(
        and(
          eq(products.organizationId, organizationId),
          sql`lower(${products.name}) = ${lowerName}`,
        ),
      )
      .limit(1);
    return row;
  }

  async create(organizationId: string, input: CreateProductDto): Promise<ProductDto> {
    const slug = input.slug ? input.slug.toLowerCase().trim() : slugify(input.name, "prod");

    try {
      const [product] = await this.db
        .insert(products)
        .values({
          organizationId,
          name: input.name.trim(),
          slug,
          description: input.description ?? null,
        })
        .returning(safeProductColumns);

      if (!product) {
        throw new Error("Failed to create product record");
      }

      return product;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("A product with this slug already exists in this organization");
      }
      throw error;
    }
  }

  async listForOrganization(organizationId: string): Promise<ProductDto[]> {
    const rows = await this.db
      .select(safeProductColumns)
      .from(products)
      .where(eq(products.organizationId, organizationId))
      .orderBy(asc(products.name));

    return rows;
  }

  async findById(organizationId: string, productId: string): Promise<ProductDto> {
    const [product] = await this.db
      .select(safeProductColumns)
      .from(products)
      .where(and(eq(products.organizationId, organizationId), eq(products.id, productId)))
      .limit(1);

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return product;
  }

  async update(
    organizationId: string,
    productId: string,
    input: UpdateProductDto,
  ): Promise<ProductDto> {
    // Ensure product exists before updating
    await this.findById(organizationId, productId);

    const updateValues: Partial<typeof products.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateValues.name = input.name.trim();
    if (input.slug !== undefined) updateValues.slug = input.slug.toLowerCase().trim();
    if (input.description !== undefined) updateValues.description = input.description;

    try {
      const [updated] = await this.db
        .update(products)
        .set(updateValues)
        .where(and(eq(products.organizationId, organizationId), eq(products.id, productId)))
        .returning(safeProductColumns);

      if (!updated) {
        throw new NotFoundException("Product not found");
      }

      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("A product with this slug already exists in this organization");
      }
      throw error;
    }
  }

  async delete(organizationId: string, productId: string): Promise<void> {
    const [deleted] = await this.db
      .delete(products)
      .where(and(eq(products.organizationId, organizationId), eq(products.id, productId)))
      .returning({ id: products.id });

    if (!deleted) {
      throw new NotFoundException("Product not found");
    }
  }
}
