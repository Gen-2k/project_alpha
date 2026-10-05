import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductsController } from "../products.controller.js";
import type { ProductsService } from "../products.service.js";

const mockProduct = {
  id: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9030",
  organizationId: "org-1",
  name: "Ride Sharing",
  slug: "ride-sharing",
  description: "Consumer mobility apps",
  createdAt: new Date("2026-10-04T00:00:00.000Z"),
  updatedAt: new Date("2026-10-04T00:00:00.000Z"),
};

describe("ProductsController", () => {
  let controller: ProductsController;
  let service: {
    create: ReturnType<typeof vi.fn>;
    listForOrganization: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      create: vi.fn(() => Promise.resolve(mockProduct)),
      listForOrganization: vi.fn(() => Promise.resolve([mockProduct])),
      findById: vi.fn(() => Promise.resolve(mockProduct)),
      update: vi.fn(() => Promise.resolve(mockProduct)),
      delete: vi.fn(() => Promise.resolve()),
    };
    controller = new ProductsController(service as unknown as ProductsService);
  });

  describe("create", () => {
    it("should call service.create with organizationId and dto", async () => {
      const dto = { name: "Ride Sharing", description: "Mobility apps" };
      const result = await controller.create("org-1", dto);
      expect(result).toEqual(mockProduct);
      expect(service.create).toHaveBeenCalledWith("org-1", dto);
    });
  });

  describe("list", () => {
    it("should call service.listForOrganization with organizationId", async () => {
      const result = await controller.list("org-1");
      expect(result).toEqual([mockProduct]);
      expect(service.listForOrganization).toHaveBeenCalledWith("org-1");
    });
  });

  describe("getById", () => {
    it("should return product details", async () => {
      const result = await controller.getById("org-1", mockProduct.id);
      expect(result).toEqual(mockProduct);
      expect(service.findById).toHaveBeenCalledWith("org-1", mockProduct.id);
    });
  });

  describe("update", () => {
    it("should update product and return updated result", async () => {
      const dto = { name: "Updated Name" };
      const result = await controller.update("org-1", mockProduct.id, dto);
      expect(result).toEqual(mockProduct);
      expect(service.update).toHaveBeenCalledWith("org-1", mockProduct.id, dto);
    });
  });

  describe("delete", () => {
    it("should delete product and return confirmation message", async () => {
      const result = await controller.delete("org-1", mockProduct.id);
      expect(result).toEqual({ message: "Product deleted successfully" });
      expect(service.delete).toHaveBeenCalledWith("org-1", mockProduct.id);
    });
  });
});
