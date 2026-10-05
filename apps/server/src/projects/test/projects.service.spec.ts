import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Db } from "@repo/database/client";
import { describe, expect, it, vi } from "vitest";

import type { ProductsService } from "../../products/products.service.js";
import { CreateProjectDto } from "../dto/create-project.dto.js";
import { ProjectsService } from "../projects.service.js";

const mockProduct = {
  id: "prod-1",
  organizationId: "org-1",
  name: "Ride Sharing",
  slug: "ride-sharing",
  description: "Consumer mobility apps",
  createdAt: new Date("2026-10-04T00:00:00.000Z"),
  updatedAt: new Date("2026-10-04T00:00:00.000Z"),
};

const mockProductSummary = {
  id: "prod-1",
  name: "Ride Sharing",
  slug: "ride-sharing",
};

const mockProjectRow = {
  id: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9030",
  organizationId: "org-1",
  productId: "prod-1",
  name: "Mobile App",
  slug: "mobile-app",
  description: "iOS and Android localization targets",
  sourceLanguage: "en-US",
  targetLanguages: ["es-ES", "ja-JP"],
  createdAt: new Date("2026-10-04T00:00:00.000Z"),
  updatedAt: new Date("2026-10-04T00:00:00.000Z"),
};

const mockProject = {
  ...mockProjectRow,
  product: mockProductSummary,
};

function createMockDb(options?: {
  selectRows?: unknown[];
  insertRows?: unknown[];
  insertError?: Error;
  updateRows?: unknown[];
  updateError?: Error;
  deleteRows?: unknown[];
}) {
  const insertedItems: unknown[] = [];
  const updatedItems: unknown[] = [];
  const defaultSelectRow = {
    project: mockProjectRow,
    product: mockProductSummary,
  };

  const db = {
    select: vi.fn(() => ({
      from: () => ({
        where: () => {
          const selectResult = options?.selectRows ?? [defaultSelectRow];
          return Object.assign(Promise.resolve(selectResult), {
            limit: () => Promise.resolve(selectResult),
            orderBy: () => Promise.resolve(selectResult),
          });
        },
        leftJoin: () => ({
          where: () => {
            const selectResult = options?.selectRows ?? [defaultSelectRow];
            return Object.assign(Promise.resolve(selectResult), {
              limit: () => Promise.resolve(selectResult),
              orderBy: () => Promise.resolve(selectResult),
            });
          },
        }),
      }),
    })),
    insert: vi.fn(() => ({
      values: (values: unknown) => {
        insertedItems.push(values);
        const resultPromise = options?.insertError
          ? Promise.reject(options.insertError)
          : Promise.resolve(options?.insertRows ?? [mockProjectRow]);
        return Object.assign(resultPromise, {
          returning: () => resultPromise,
        });
      },
    })),
    update: vi.fn(() => ({
      set: (values: unknown) => {
        updatedItems.push(values);
        return {
          where: () => {
            const resultPromise = options?.updateError
              ? Promise.reject(options.updateError)
              : Promise.resolve(options?.updateRows ?? [mockProjectRow]);
            return Object.assign(resultPromise, {
              returning: () => resultPromise,
            });
          },
        };
      },
    })),
    delete: vi.fn(() => ({
      where: () => {
        const resultPromise = Promise.resolve(options?.deleteRows ?? [{ id: mockProject.id }]);
        return Object.assign(resultPromise, {
          returning: () => resultPromise,
        });
      },
    })),
  };
  return { db: db as unknown as Db, insertedItems, updatedItems };
}

function createMockProductsService() {
  return {
    findOrCreateByName: vi.fn(() => Promise.resolve(mockProduct)),
    findById: vi.fn(() => Promise.resolve(mockProduct)),
  };
}

describe("ProjectsService", () => {
  describe("create", () => {
    it("should create project linking to existing productId", async () => {
      const { db, insertedItems } = createMockDb();
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      const result = await service.create("org-1", {
        name: "Mobile App",
        slug: "mobile-app",
        productId: "prod-1",
        description: "iOS & Android",
        sourceLanguage: "en-US",
        targetLanguages: ["es-ES", "ja-JP"],
      });

      expect(result).toEqual(mockProject);
      expect(mockProductsService.findById).toHaveBeenCalledWith("org-1", "prod-1");
      expect(insertedItems[0]).toEqual({
        organizationId: "org-1",
        productId: "prod-1",
        name: "Mobile App",
        slug: "mobile-app",
        description: "iOS & Android",
        sourceLanguage: "en-US",
        targetLanguages: ["es-ES", "ja-JP"],
      });
    });

    it("should find or create product inline when productName is provided", async () => {
      const { db, insertedItems } = createMockDb();
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      const result = await service.create("org-1", {
        name: "Mobile App",
        productName: "Ride Sharing",
      });

      expect(result.product).toEqual(mockProductSummary);
      expect(mockProductsService.findOrCreateByName).toHaveBeenCalledWith("org-1", "Ride Sharing");
      expect((insertedItems[0] as { productId: string }).productId).toBe("prod-1");
    });

    it("should auto-slugify project name if slug is not provided", async () => {
      const { db, insertedItems } = createMockDb();
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      await service.create("org-1", {
        name: "Web Dashboard Portal",
      });

      const inserted = insertedItems[0] as { slug: string; sourceLanguage: string };
      expect(inserted.slug).toBe("web-dashboard-portal");
      expect(inserted.sourceLanguage).toBe("en-US");
    });

    it("should throw ConflictException on unique slug violation (code 23505)", async () => {
      const uniqueError = Object.assign(new Error("duplicate key"), { code: "23505" });
      const { db } = createMockDb({ insertError: uniqueError });
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      await expect(
        service.create("org-1", {
          name: "Mobile App",
          slug: "mobile-app",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw error if insert returns no row", async () => {
      const { db } = createMockDb({ insertRows: [] });
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      await expect(service.create("org-1", { name: "Mobile App" })).rejects.toThrow(
        "Failed to create project record",
      );
    });

    it("should rethrow non-unique database error on create", async () => {
      const dbError = new Error("Connection failed");
      const { db } = createMockDb({ insertError: dbError });
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      await expect(service.create("org-1", { name: "Mobile App" })).rejects.toThrow(
        "Connection failed",
      );
    });
  });

  describe("listForOrganization", () => {
    it("should return projects for the organization", async () => {
      const { db } = createMockDb();
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      const result = await service.listForOrganization("org-1");
      expect(result).toEqual([mockProject]);
    });

    it("should filter by query when provided", async () => {
      const { db } = createMockDb();
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      const result = await service.listForOrganization("org-1", { productName: "Ride Sharing" });
      expect(result).toEqual([mockProject]);
    });

    it("should filter by productId query when provided", async () => {
      const { db } = createMockDb();
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      const result = await service.listForOrganization("org-1", { productId: "prod-1" });
      expect(result).toEqual([mockProject]);
    });
  });

  describe("findById", () => {
    it("should return project if found in organization", async () => {
      const { db } = createMockDb();
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      const result = await service.findById("org-1", mockProject.id);
      expect(result).toEqual(mockProject);
    });

    it("should throw NotFoundException if project not found", async () => {
      const { db } = createMockDb({ selectRows: [] });
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      await expect(service.findById("org-1", "non-existent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("should update project fields successfully", async () => {
      const updatedProjectRow = { ...mockProjectRow, name: "Updated Mobile App" };
      const { db, updatedItems } = createMockDb({
        selectRows: [{ project: updatedProjectRow, product: mockProductSummary }],
        updateRows: [updatedProjectRow],
      });
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      const result = await service.update("org-1", mockProject.id, {
        name: "Updated Mobile App",
      });

      expect(result.name).toBe("Updated Mobile App");
      expect((updatedItems[0] as { name: string }).name).toBe("Updated Mobile App");
    });

    it("should throw NotFoundException if project to update does not exist", async () => {
      const { db } = createMockDb({ selectRows: [] });
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      await expect(service.update("org-1", "non-existent", { name: "New Name" })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should unlink product when productId is set to null", async () => {
      const unlinkedProjectRow = { ...mockProjectRow, productId: null };
      const { db, updatedItems } = createMockDb({
        selectRows: [{ project: unlinkedProjectRow, product: null }],
        updateRows: [unlinkedProjectRow],
      });
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      const result = await service.update("org-1", mockProject.id, {
        productId: null,
      });

      expect(result.product).toBeNull();
      expect((updatedItems[0] as { productId: null }).productId).toBeNull();
    });

    it("should link to a different productId when provided", async () => {
      const updatedProjectRow = { ...mockProjectRow, productId: "prod-2" };
      const { db, updatedItems } = createMockDb({
        selectRows: [{ project: updatedProjectRow, product: mockProductSummary }],
        updateRows: [updatedProjectRow],
      });
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      await service.update("org-1", mockProject.id, {
        productId: "prod-2",
      });

      expect(mockProductsService.findById).toHaveBeenCalledWith("org-1", "prod-2");
      expect((updatedItems[0] as { productId: string }).productId).toBe("prod-2");
    });

    it("should find or create product inline when productName is provided on update", async () => {
      const updatedProjectRow = { ...mockProjectRow, productId: "prod-1" };
      const { db, updatedItems } = createMockDb({
        selectRows: [{ project: updatedProjectRow, product: mockProductSummary }],
        updateRows: [updatedProjectRow],
      });
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      await service.update("org-1", mockProject.id, {
        productName: "New Product Group",
      });

      expect(mockProductsService.findOrCreateByName).toHaveBeenCalledWith(
        "org-1",
        "New Product Group",
      );
      expect((updatedItems[0] as { productId: string }).productId).toBe("prod-1");
    });

    it("should unlink product when productName is empty string on update", async () => {
      const unlinkedProjectRow = { ...mockProjectRow, productId: null };
      const { db, updatedItems } = createMockDb({
        selectRows: [{ project: unlinkedProjectRow, product: null }],
        updateRows: [unlinkedProjectRow],
      });
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      await service.update("org-1", mockProject.id, {
        productName: "",
      });

      expect((updatedItems[0] as { productId: null }).productId).toBeNull();
    });

    it("should throw NotFoundException if update returns no row", async () => {
      const { db } = createMockDb({
        selectRows: [{ project: mockProjectRow, product: mockProductSummary }],
        updateRows: [],
      });
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      await expect(
        service.update("org-1", mockProject.id, { name: "Updated Mobile App" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ConflictException on slug unique violation on update", async () => {
      const uniqueError = Object.assign(new Error("duplicate key"), { code: "23505" });
      const { db } = createMockDb({
        selectRows: [{ project: mockProjectRow, product: mockProductSummary }],
        updateError: uniqueError,
      });
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      await expect(
        service.update("org-1", mockProject.id, { slug: "already-taken" }),
      ).rejects.toThrow(ConflictException);
    });

    it("should rethrow non-unique database error on update", async () => {
      const dbError = new Error("Connection failed");
      const { db } = createMockDb({
        selectRows: [{ project: mockProjectRow, product: mockProductSummary }],
        updateError: dbError,
      });
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      await expect(
        service.update("org-1", mockProject.id, { name: "Updated Mobile App" }),
      ).rejects.toThrow("Connection failed");
    });
  });

  describe("delete", () => {
    it("should delete project successfully", async () => {
      const { db } = createMockDb({ deleteRows: [{ id: mockProject.id }] });
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      await expect(service.delete("org-1", mockProject.id)).resolves.toBeUndefined();
    });

    it("should throw NotFoundException if project to delete does not exist", async () => {
      const { db } = createMockDb({ deleteRows: [] });
      const mockProductsService = createMockProductsService();
      const service = new ProjectsService(db, mockProductsService as unknown as ProductsService);

      await expect(service.delete("org-1", "non-existent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("CreateProjectDto", () => {
    it("should initialize default sourceLanguage and targetLanguages", () => {
      const dto = new CreateProjectDto();
      expect(dto.sourceLanguage).toBe("en-US");
      expect(dto.targetLanguages).toEqual([]);
    });
  });
});
