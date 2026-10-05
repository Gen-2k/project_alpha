import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectsController } from "../projects.controller.js";
import type { ProjectsService } from "../projects.service.js";

const mockProject = {
  id: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9030",
  organizationId: "org-1",
  productId: "prod-1",
  product: {
    id: "prod-1",
    name: "Ride Sharing",
    slug: "ride-sharing",
  },
  name: "Mobile App",
  slug: "mobile-app",
  description: "iOS and Android localization targets",
  sourceLanguage: "en-US",
  targetLanguages: ["es-ES", "ja-JP"],
  createdAt: new Date("2026-10-04T00:00:00.000Z"),
  updatedAt: new Date("2026-10-04T00:00:00.000Z"),
};

describe("ProjectsController", () => {
  let controller: ProjectsController;
  let service: {
    create: ReturnType<typeof vi.fn>;
    listForOrganization: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      create: vi.fn(() => Promise.resolve(mockProject)),
      listForOrganization: vi.fn(() => Promise.resolve([mockProject])),
      findById: vi.fn(() => Promise.resolve(mockProject)),
      update: vi.fn(() => Promise.resolve(mockProject)),
      delete: vi.fn(() => Promise.resolve()),
    };
    controller = new ProjectsController(service as unknown as ProjectsService);
  });

  describe("create", () => {
    it("should call service.create with organizationId and dto", async () => {
      const dto = {
        name: "Mobile App",
        productName: "Ride Sharing",
        sourceLanguage: "en-US",
        targetLanguages: ["es-ES"],
      };

      const result = await controller.create("org-1", dto);
      expect(result).toEqual(mockProject);
      expect(service.create).toHaveBeenCalledWith("org-1", dto);
    });
  });

  describe("list", () => {
    it("should call service.listForOrganization with organizationId and query", async () => {
      const query = { productName: "Ride Sharing" };
      const result = await controller.list("org-1", query);
      expect(result).toEqual([mockProject]);
      expect(service.listForOrganization).toHaveBeenCalledWith("org-1", query);
    });

    it("should call service.listForOrganization with empty query", async () => {
      const query = {};
      const result = await controller.list("org-1", query);
      expect(result).toEqual([mockProject]);
      expect(service.listForOrganization).toHaveBeenCalledWith("org-1", query);
    });
  });

  describe("getById", () => {
    it("should return project details", async () => {
      const result = await controller.getById("org-1", mockProject.id);
      expect(result).toEqual(mockProject);
      expect(service.findById).toHaveBeenCalledWith("org-1", mockProject.id);
    });
  });

  describe("update", () => {
    it("should update project and return updated result", async () => {
      const dto = { name: "Updated Mobile App" };
      const result = await controller.update("org-1", mockProject.id, dto);
      expect(result).toEqual(mockProject);
      expect(service.update).toHaveBeenCalledWith("org-1", mockProject.id, dto);
    });
  });

  describe("delete", () => {
    it("should delete project and return confirmation message", async () => {
      const result = await controller.delete("org-1", mockProject.id);
      expect(result).toEqual({ message: "Project deleted successfully" });
      expect(service.delete).toHaveBeenCalledWith("org-1", mockProject.id);
    });
  });
});
