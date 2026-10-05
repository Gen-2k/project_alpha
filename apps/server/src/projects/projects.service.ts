import { randomBytes } from "node:crypto";

import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Db } from "@repo/database/client";
import { DB } from "@repo/database/client";
import { products, projects } from "@repo/database/schema";
import type { CreateProjectDto, ProjectDto, UpdateProjectDto } from "@repo/validation/projects";
import { and, desc, eq, type SQL } from "drizzle-orm";

import { ProductsService } from "../products/products.service.js";

const safeProjectColumns = {
  id: projects.id,
  organizationId: projects.organizationId,
  productId: projects.productId,
  name: projects.name,
  slug: projects.slug,
  description: projects.description,
  sourceLanguage: projects.sourceLanguage,
  targetLanguages: projects.targetLanguages,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
};

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length >= 3 ? base : `proj-${randomBytes(3).toString("hex")}`;
}

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly productsService: ProductsService,
  ) {}

  async create(organizationId: string, input: CreateProjectDto): Promise<ProjectDto> {
    const slug = input.slug ? input.slug.toLowerCase().trim() : slugify(input.name);

    // Resolve product: either existing ID or find-or-create inline by name
    let resolvedProductId: string | null = null;
    let resolvedProductSummary: { id: string; name: string; slug: string } | null = null;

    if (input.productId) {
      const product = await this.productsService.findById(organizationId, input.productId);
      resolvedProductId = product.id;
      resolvedProductSummary = { id: product.id, name: product.name, slug: product.slug };
    } else if (input.productName && input.productName.trim().length > 0) {
      const product = await this.productsService.findOrCreateByName(
        organizationId,
        input.productName,
      );
      resolvedProductId = product.id;
      resolvedProductSummary = { id: product.id, name: product.name, slug: product.slug };
    }

    try {
      const [project] = await this.db
        .insert(projects)
        .values({
          organizationId,
          productId: resolvedProductId,
          name: input.name,
          slug,
          description: input.description ?? null,
          sourceLanguage: input.sourceLanguage ?? "en-US",
          targetLanguages: input.targetLanguages ?? [],
        })
        .returning(safeProjectColumns);

      if (!project) {
        throw new Error("Failed to create project record");
      }

      return {
        ...project,
        product: resolvedProductSummary,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("A project with this slug already exists in this organization");
      }
      throw error;
    }
  }

  async listForOrganization(
    organizationId: string,
    query?: { productId?: string; productName?: string },
  ): Promise<ProjectDto[]> {
    const conditions: (SQL | undefined)[] = [eq(projects.organizationId, organizationId)];

    if (query?.productId) {
      conditions.push(eq(projects.productId, query.productId));
    }
    if (query?.productName && query.productName.trim().length > 0) {
      conditions.push(eq(products.name, query.productName.trim()));
    }

    const rows = await this.db
      .select({
        project: safeProjectColumns,
        product: {
          id: products.id,
          name: products.name,
          slug: products.slug,
        },
      })
      .from(projects)
      .leftJoin(products, eq(projects.productId, products.id))
      .where(and(...conditions))
      .orderBy(desc(projects.createdAt));

    return rows.map((row) => ({
      ...row.project,
      product: row.product?.id ? row.product : null,
    }));
  }

  async findById(organizationId: string, projectId: string): Promise<ProjectDto> {
    const [row] = await this.db
      .select({
        project: safeProjectColumns,
        product: {
          id: products.id,
          name: products.name,
          slug: products.slug,
        },
      })
      .from(projects)
      .leftJoin(products, eq(projects.productId, products.id))
      .where(and(eq(projects.organizationId, organizationId), eq(projects.id, projectId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Project not found");
    }

    return {
      ...row.project,
      product: row.product?.id ? row.product : null,
    };
  }

  async update(
    organizationId: string,
    projectId: string,
    input: UpdateProjectDto,
  ): Promise<ProjectDto> {
    // Ensure project exists before updating
    await this.findById(organizationId, projectId);

    const updateValues: Partial<typeof projects.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateValues.name = input.name;
    if (input.slug !== undefined) updateValues.slug = input.slug.toLowerCase().trim();
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.sourceLanguage !== undefined) updateValues.sourceLanguage = input.sourceLanguage;
    if (input.targetLanguages !== undefined) updateValues.targetLanguages = input.targetLanguages;

    if (input.productId !== undefined) {
      if (input.productId !== null) {
        await this.productsService.findById(organizationId, input.productId);
        updateValues.productId = input.productId;
      } else {
        updateValues.productId = null;
      }
    } else if (input.productName !== undefined) {
      if (input.productName && input.productName.trim().length > 0) {
        const product = await this.productsService.findOrCreateByName(
          organizationId,
          input.productName,
        );
        updateValues.productId = product.id;
      } else {
        updateValues.productId = null;
      }
    }

    try {
      const [updated] = await this.db
        .update(projects)
        .set(updateValues)
        .where(and(eq(projects.organizationId, organizationId), eq(projects.id, projectId)))
        .returning(safeProjectColumns);

      if (!updated) {
        throw new NotFoundException("Project not found");
      }

      return await this.findById(organizationId, projectId);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("A project with this slug already exists in this organization");
      }
      throw error;
    }
  }

  async delete(organizationId: string, projectId: string): Promise<void> {
    const [deleted] = await this.db
      .delete(projects)
      .where(and(eq(projects.organizationId, organizationId), eq(projects.id, projectId)))
      .returning({ id: projects.id });

    if (!deleted) {
      throw new NotFoundException("Project not found");
    }
  }
}
