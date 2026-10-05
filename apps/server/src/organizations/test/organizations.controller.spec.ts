import { ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthenticatedRequest } from "../../auth/auth.types.js";
import { OrganizationsController } from "../organizations.controller.js";
import type { OrganizationsService } from "../organizations.service.js";
import type { OrgAuthenticatedRequest } from "../organizations.types.js";

const mockOrg = {
  id: "org-1",
  name: "Acme Corp",
  slug: "acme-corp",
  planTier: "free",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMember = {
  id: "member-1",
  organizationId: "org-1",
  userId: "user-1",
  role: "owner" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockInvitation = {
  id: "inv-1",
  organizationId: "org-1",
  email: "invitee@example.com",
  role: "developer" as const,
  invitedByUserId: "user-1",
  tokenHash: "hash-123",
  expiresAt: new Date(Date.now() + 7 * 86400000),
  acceptedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockInvitationDetails = {
  organizationId: "org-1",
  organizationName: "Acme Corp",
  email: "invitee@example.com",
  role: "developer" as const,
  inviterName: "Ada Lovelace",
  inviterEmail: "ada@example.com",
  expiresAt: new Date(Date.now() + 7 * 86400000),
};

describe("OrganizationsController", () => {
  let controller: OrganizationsController;
  let service: {
    create: ReturnType<typeof vi.fn>;
    listForUser: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    listMembers: ReturnType<typeof vi.fn>;
    addMember: ReturnType<typeof vi.fn>;
    updateMemberRole: ReturnType<typeof vi.fn>;
    removeMember: ReturnType<typeof vi.fn>;
    createInvitation: ReturnType<typeof vi.fn>;
    listInvitations: ReturnType<typeof vi.fn>;
    revokeInvitation: ReturnType<typeof vi.fn>;
    getInvitationByToken: ReturnType<typeof vi.fn>;
    acceptInvitation: ReturnType<typeof vi.fn>;
  };

  const mockReq = {
    user: { sub: "user-1", email: "ada@example.com" },
    orgMembership: mockMember,
  } as unknown as OrgAuthenticatedRequest;

  beforeEach(() => {
    service = {
      create: vi.fn(() => Promise.resolve(mockOrg)),
      listForUser: vi.fn(() => Promise.resolve([{ organization: mockOrg, role: "owner" }])),
      findById: vi.fn(() => Promise.resolve(mockOrg)),
      update: vi.fn(() => Promise.resolve(mockOrg)),
      delete: vi.fn(() => Promise.resolve()),
      listMembers: vi.fn(() => Promise.resolve([mockMember])),
      addMember: vi.fn(() => Promise.resolve(mockMember)),
      updateMemberRole: vi.fn(() => Promise.resolve(mockMember)),
      removeMember: vi.fn(() => Promise.resolve()),
      createInvitation: vi.fn(() => Promise.resolve(mockInvitation)),
      listInvitations: vi.fn(() => Promise.resolve([mockInvitation])),
      revokeInvitation: vi.fn(() => Promise.resolve()),
      getInvitationByToken: vi.fn(() => Promise.resolve(mockInvitationDetails)),
      acceptInvitation: vi.fn(() =>
        Promise.resolve({
          organizationId: "org-1",
          message: "Invitation accepted successfully",
        }),
      ),
    };
    controller = new OrganizationsController(service as unknown as OrganizationsService);
  });

  describe("create", () => {
    it("should call service.create with authenticated user sub", async () => {
      const dto = { name: "Acme Corp" };
      const result = await controller.create(dto, mockReq);
      expect(result).toEqual(mockOrg);
      expect(service.create).toHaveBeenCalledWith("user-1", dto);
    });
  });

  describe("listUserOrganizations", () => {
    it("should call service.listForUser", async () => {
      const result = await controller.listUserOrganizations(mockReq);
      expect(result).toHaveLength(1);
      expect(service.listForUser).toHaveBeenCalledWith("user-1");
    });
  });

  describe("getById", () => {
    it("should return organization details", async () => {
      const result = await controller.getById("org-1");
      expect(result).toEqual(mockOrg);
      expect(service.findById).toHaveBeenCalledWith("org-1");
    });

    it("should throw ForbiddenException if organization not found", async () => {
      service.findById.mockResolvedValueOnce(undefined);
      await expect(controller.getById("org-unknown")).rejects.toThrow(ForbiddenException);
    });
  });

  describe("update", () => {
    it("should update organization", async () => {
      const dto = { name: "Updated" };
      const result = await controller.update("org-1", dto);
      expect(result).toEqual(mockOrg);
      expect(service.update).toHaveBeenCalledWith("org-1", dto);
    });
  });

  describe("delete", () => {
    it("should delete organization", async () => {
      const result = await controller.delete("org-1");
      expect(result).toEqual({ message: "Organization deleted successfully" });
      expect(service.delete).toHaveBeenCalledWith("org-1");
    });
  });

  describe("listMembers", () => {
    it("should list members", async () => {
      const result = await controller.listMembers("org-1");
      expect(result).toEqual([mockMember]);
      expect(service.listMembers).toHaveBeenCalledWith("org-1");
    });
  });

  describe("addMember", () => {
    it("should add member with caller role and actor user id", async () => {
      const dto = { email: "colleague@example.com", role: "developer" as const };
      const result = await controller.addMember("org-1", dto, mockReq);
      expect(result).toEqual(mockMember);
      expect(service.addMember).toHaveBeenCalledWith("org-1", dto, "owner", "user-1");
    });
  });

  describe("updateMemberRole", () => {
    it("should update member role with caller role", async () => {
      const dto = { role: "admin" as const };
      const result = await controller.updateMemberRole("org-1", "member-1", dto, mockReq);
      expect(result).toEqual(mockMember);
      expect(service.updateMemberRole).toHaveBeenCalledWith("org-1", "member-1", "admin", "owner");
    });
  });

  describe("removeMember", () => {
    it("should permit self-removal", async () => {
      const selfReq = {
        user: { sub: "user-1", email: "ada@example.com" },
        orgMembership: { ...mockMember, id: "target-member-id", role: "developer" },
      } as unknown as OrgAuthenticatedRequest;

      const result = await controller.removeMember("org-1", "target-member-id", selfReq);
      expect(result).toEqual({ message: "Member removed successfully" });
      expect(service.removeMember).toHaveBeenCalledWith(
        "org-1",
        "target-member-id",
        "developer",
        true,
      );
    });

    it("should permit admin/owner removing other members", async () => {
      const adminReq = {
        user: { sub: "user-admin", email: "admin@example.com" },
        orgMembership: { ...mockMember, id: "admin-member-id", role: "admin" },
      } as unknown as OrgAuthenticatedRequest;

      const result = await controller.removeMember("org-1", "other-member-id", adminReq);
      expect(result).toEqual({ message: "Member removed successfully" });
      expect(service.removeMember).toHaveBeenCalledWith("org-1", "other-member-id", "admin", false);
    });

    it("should throw ForbiddenException if caller has no role and is not self", async () => {
      const unauthReq = {
        user: { sub: "user-other", email: "other@example.com" },
        orgMembership: undefined,
      } as unknown as OrgAuthenticatedRequest;

      await expect(controller.removeMember("org-1", "target-member-id", unauthReq)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("getInvitationByToken", () => {
    it("should return invitation details by token", async () => {
      const result = await controller.getInvitationByToken("raw-token-123");
      expect(result).toEqual(mockInvitationDetails);
      expect(service.getInvitationByToken).toHaveBeenCalledWith("raw-token-123");
    });
  });

  describe("acceptInvitation", () => {
    it("should accept invitation with authenticated user id", async () => {
      const dto = { token: "raw-token-123", name: "Alice", password: "Password123!" };
      const result = await controller.acceptInvitation(dto, mockReq);
      expect(result).toEqual({
        organizationId: "org-1",
        message: "Invitation accepted successfully",
      });
      expect(service.acceptInvitation).toHaveBeenCalledWith(
        "raw-token-123",
        { name: "Alice", password: "Password123!" },
        "user-1",
      );
    });

    it("should accept invitation without authenticated user id", async () => {
      const unauthReq = { user: undefined } as unknown as AuthenticatedRequest;
      const dto = { token: "raw-token-123", name: "Alice", password: "Password123!" };
      const result = await controller.acceptInvitation(dto, unauthReq);
      expect(result).toEqual({
        organizationId: "org-1",
        message: "Invitation accepted successfully",
      });
      expect(service.acceptInvitation).toHaveBeenCalledWith(
        "raw-token-123",
        { name: "Alice", password: "Password123!" },
        undefined,
      );
    });
  });

  describe("createInvitation", () => {
    it("should create invitation and return invitation record", async () => {
      const dto = { email: "invitee@example.com", role: "developer" as const };
      const result = await controller.createInvitation("org-1", dto, mockReq);
      expect(result).toEqual(mockInvitation);
      expect(service.createInvitation).toHaveBeenCalledWith("org-1", "user-1", "owner", dto);
    });
  });

  describe("listInvitations", () => {
    it("should list invitations for organization", async () => {
      const result = await controller.listInvitations("org-1");
      expect(result).toEqual([mockInvitation]);
      expect(service.listInvitations).toHaveBeenCalledWith("org-1");
    });
  });

  describe("revokeInvitation", () => {
    it("should revoke invitation and return success message", async () => {
      const result = await controller.revokeInvitation("org-1", "inv-1");
      expect(result).toEqual({ message: "Invitation revoked successfully" });
      expect(service.revokeInvitation).toHaveBeenCalledWith("org-1", "inv-1");
    });
  });
});
