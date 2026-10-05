import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Db } from "@repo/database/client";
import { describe, expect, it, vi } from "vitest";

import { ProductsService } from "../products.service.js";

const mockProduct = {
  id: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9030",
  organizationId: "org-1",
  name: "Ride Sharing",
  slug: "ride-sharing",
  description: "Consumer mobility apps",
  createdAt: new Date("2026-10-04T00:00:00.000Z"),
  updatedAt: new Date("2026-10-04T00:00:00.000Z"),
};

function createMockDb(options?: {
  selectRows?: unknown[];
  insertRows?: unknown[];
  insertError?: Error;
  insertResponses?: { rows?: unknown[]; error?: Error }[];
  updateRows?: unknown[];
  updateError?: Error;
  deleteRows?: unknown[];
}) {
  const insertedItems: unknown[] = [];
  const updatedItems: unknown[] = [];
  let insertCallCount = 0;
  const db = {
    select: vi.fn(() => ({
      from: () => ({
        where: () => {
          const selectResult = options?.selectRows ?? [mockProduct];
          return Object.assign(Promise.resolve(selectResult), {
            limit: () => Promise.resolve(selectResult),
            orderBy: () => Promise.resolve(selectResult),
          });
        },
      }),
    })),
    insert: vi.fn(() => ({
      values: (values: unknown) => {
        insertedItems.push(values);
        let resultPromise: Promise<unknown>;
        if (options?.insertResponses && options.insertResponses.length > insertCallCount) {
          const resp = options.insertResponses[insertCallCount];
          insertCallCount++;
          resultPromise = resp?.error
            ? Promise.reject(resp.error)
            : Promise.resolve(resp?.rows ?? [mockProduct]);
        } else if (options?.insertError) {
          resultPromise = Promise.reject(options.insertError);
        } else {
          resultPromise = Promise.resolve(options?.insertRows ?? [mockProduct]);
        }
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
              : Promise.resolve(options?.updateRows ?? [mockProduct]);
            return Object.assign(resultPromise, {
              returning: () => resultPromise,
            });
          },
        };
      },
    })),
    delete: vi.fn(() => ({
      where: () => {
        const resultPromise = Promise.resolve(options?.deleteRows ?? [{ id: mockProduct.id }]);
        return Object.assign(resultPromise, {
          returning: () => resultPromise,
        });
      },
    })),
  };
  return { db: db as unknown as Db, insertedItems, updatedItems };
}

describe("ProductsService", () => {
  describe("findOrCreateByName", () => {
    it("should return existing product when found case-insensitively", async () => {
      const { db } = createMockDb({ selectRows: [mockProduct] });
      const service = new ProductsService(db);

      const result = await service.findOrCreateByName("org-1", "ride sharing");
      expect(result).toEqual(mockProduct);
    });

    it("should create new product when not found", async () => {
      const { db, insertedItems } = createMockDb({
        selectRows: [],
        insertRows: [mockProduct],
      });
      const service = new ProductsService(db);

      const result = await service.findOrCreateByName("org-1", "New Product");
      expect(result).toEqual(mockProduct);
      expect((insertedItems[0] as { name: string }).name).toBe("New Product");
    });

    it("should retry with random hex suffix when slug collision occurs during inline create", async () => {
      const uniqueError = Object.assign(new Error("duplicate key"), { code: "23505" });
      const retriedProduct = { ...mockProduct, slug: "ride-sharing-a1b2" };
      const { db, insertedItems } = createMockDb({
        selectRows: [],
        insertResponses: [{ error: uniqueError }, { rows: [retriedProduct] }],
      });
      const service = new ProductsService(db);

      const result = await service.findOrCreateByName("org-1", "Ride Sharing");
      expect(result).toEqual(retriedProduct);
      expect(insertedItems).toHaveLength(2);
      expect((insertedItems[1] as { slug: string }).slug).toMatch(/^ride-sharing-[0-9a-f]{4}$/);
    });

    it("should throw error if retried insert after slug collision returns no row", async () => {
      const uniqueError = Object.assign(new Error("duplicate key"), { code: "23505" });
      const { db } = createMockDb({
        selectRows: [],
        insertResponses: [{ error: uniqueError }, { rows: [] }],
      });
      const service = new ProductsService(db);

      await expect(service.findOrCreateByName("org-1", "Ride Sharing")).rejects.toThrow(
        "Failed to create product record after slug collision retry",
      );
    });

    it("should throw error if initial product insert returns no row", async () => {
      const { db } = createMockDb({
        selectRows: [],
        insertRows: [],
      });
      const service = new ProductsService(db);

      await expect(service.findOrCreateByName("org-1", "Ride Sharing")).rejects.toThrow(
        "Failed to create product record",
      );
    });

    it("should rethrow non-unique database error in findOrCreateByName", async () => {
      const dbError = new Error("Connection failed");
      const { db } = createMockDb({
        selectRows: [],
        insertError: dbError,
      });
      const service = new ProductsService(db);

      await expect(service.findOrCreateByName("org-1", "Ride Sharing")).rejects.toThrow(
        "Connection failed",
      );
    });
  });

  describe("create", () => {
    it("should create product with explicit slug and description", async () => {
      const { db, insertedItems } = createMockDb();
      const service = new ProductsService(db);

      const result = await service.create("org-1", {
        name: "Food Delivery",
        slug: "food-delivery",
        description: "Eats platform",
      });

      expect(result).toEqual(mockProduct);
      expect(insertedItems[0]).toEqual({
        organizationId: "org-1",
        name: "Food Delivery",
        slug: "food-delivery",
        description: "Eats platform",
      });
    });

    it("should auto-slugify product name if slug is omitted", async () => {
      const { db, insertedItems } = createMockDb();
      const service = new ProductsService(db);

      await service.create("org-1", {
        name: "Grocery Express",
      });

      const inserted = insertedItems[0] as { slug: string };
      expect(inserted.slug).toBe("grocery-express");
    });

    it("should throw ConflictException on unique slug collision", async () => {
      const uniqueError = Object.assign(new Error("duplicate key"), { code: "23505" });
      const { db } = createMockDb({ insertError: uniqueError });
      const service = new ProductsService(db);

      await expect(
        service.create("org-1", {
          name: "Food Delivery",
          slug: "food-delivery",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw error if insert returns no row", async () => {
      const { db } = createMockDb({ insertRows: [] });
      const service = new ProductsService(db);

      await expect(service.create("org-1", { name: "Food Delivery" })).rejects.toThrow(
        "Failed to create product record",
      );
    });

    it("should rethrow non-unique database error on create", async () => {
      const dbError = new Error("Connection failed");
      const { db } = createMockDb({ insertError: dbError });
      const service = new ProductsService(db);

      await expect(service.create("org-1", { name: "Food Delivery" })).rejects.toThrow(
        "Connection failed",
      );
    });
  });

  describe("listForOrganization", () => {
    it("should return products for organization", async () => {
      const { db } = createMockDb({ selectRows: [mockProduct] });
      const service = new ProductsService(db);

      const result = await service.listForOrganization("org-1");
      expect(result).toEqual([mockProduct]);
    });
  });

  describe("findById", () => {
    it("should return product if found in organization", async () => {
      const { db } = createMockDb({ selectRows: [mockProduct] });
      const service = new ProductsService(db);

      const result = await service.findById("org-1", mockProduct.id);
      expect(result).toEqual(mockProduct);
    });

    it("should throw NotFoundException if product not found", async () => {
      const { db } = createMockDb({ selectRows: [] });
      const service = new ProductsService(db);

      await expect(service.findById("org-1", "non-existent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("should update product successfully", async () => {
      const updatedProduct = { ...mockProduct, name: "Updated Name" };
      const { db, updatedItems } = createMockDb({
        selectRows: [mockProduct],
        updateRows: [updatedProduct],
      });
      const service = new ProductsService(db);

      const result = await service.update("org-1", mockProduct.id, {
        name: "Updated Name",
      });

      expect(result.name).toBe("Updated Name");
      expect((updatedItems[0] as { name: string }).name).toBe("Updated Name");
    });

    it("should throw NotFoundException if product to update does not exist", async () => {
      const { db } = createMockDb({ selectRows: [] });
      const service = new ProductsService(db);

      await expect(service.update("org-1", "non-existent", { name: "New Name" })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw ConflictException if updated slug collides", async () => {
      const uniqueError = Object.assign(new Error("duplicate key"), { code: "23505" });
      const { db } = createMockDb({
        selectRows: [mockProduct],
        updateError: uniqueError,
      });
      const service = new ProductsService(db);

      await expect(
        service.update("org-1", mockProduct.id, { slug: "already-taken" }),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw NotFoundException if update returns no row", async () => {
      const { db } = createMockDb({
        selectRows: [mockProduct],
        updateRows: [],
      });
      const service = new ProductsService(db);

      await expect(
        service.update("org-1", mockProduct.id, { name: "Updated Name" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should rethrow non-unique database error on update", async () => {
      const dbError = new Error("Connection failed");
      const { db } = createMockDb({
        selectRows: [mockProduct],
        updateError: dbError,
      });
      const service = new ProductsService(db);

      await expect(
        service.update("org-1", mockProduct.id, { name: "Updated Name" }),
      ).rejects.toThrow("Connection failed");
    });
  });

  describe("delete", () => {
    it("should delete product successfully", async () => {
      const { db } = createMockDb({ deleteRows: [{ id: mockProduct.id }] });
      const service = new ProductsService(db);

      await expect(service.delete("org-1", mockProduct.id)).resolves.toBeUndefined();
    });

    it("should throw NotFoundException if product to delete does not exist", async () => {
      const { db } = createMockDb({ deleteRows: [] });
      const service = new ProductsService(db);

      await expect(service.delete("org-1", "non-existent")).rejects.toThrow(NotFoundException);
    });
  });
});
