import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrgMembershipGuard } from "../guards/org-membership.guard.js";
import type { OrganizationsService } from "../organizations.service.js";
import type { OrgAuthenticatedRequest } from "../organizations.types.js";

describe("OrgMembershipGuard", () => {
  let guard: OrgMembershipGuard;
  let reflector: {
    getAllAndOverride: ReturnType<typeof vi.fn>;
  };
  let orgsService: {
    getMembership: ReturnType<typeof vi.fn>;
  };

  const createMockContext = (req: Partial<OrgAuthenticatedRequest>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
    };
    orgsService = {
      getMembership: vi.fn(),
    };
    guard = new OrgMembershipGuard(
      reflector as unknown as Reflector,
      orgsService as unknown as OrganizationsService,
    );
  });

  it("should return true when no organization id is in params", async () => {
    const ctx = createMockContext({ params: {} });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it("should extract organizationId from req.params.organizationId for nested routes", async () => {
    const membership = {
      id: "mem-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "owner" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    orgsService.getMembership.mockResolvedValueOnce(membership);
    const req: Partial<OrgAuthenticatedRequest> = {
      params: { organizationId: "org-1" },
      user: { sub: "user-1", email: "ada@example.com" },
    };
    const ctx = createMockContext(req);

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(orgsService.getMembership).toHaveBeenCalledWith("org-1", "user-1");
  });

  it("should throw ForbiddenException if user has no id in token", async () => {
    const ctx = createMockContext({
      params: { id: "org-1" },
      user: {} as never,
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow("Authentication is required");
  });

  it("should throw ForbiddenException if user is not a member of the organization", async () => {
    orgsService.getMembership.mockResolvedValueOnce(undefined);
    const ctx = createMockContext({
      params: { id: "org-1" },
      user: { sub: "user-1", email: "ada@example.com" },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      "You do not have access to this organization",
    );
  });

  it("should permit member and attach membership to request when no roles required", async () => {
    const membership = {
      id: "mem-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "developer" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    orgsService.getMembership.mockResolvedValueOnce(membership);
    reflector.getAllAndOverride.mockReturnValueOnce(undefined);

    const req: Partial<OrgAuthenticatedRequest> = {
      params: { id: "org-1" },
      user: { sub: "user-1", email: "ada@example.com" },
    };
    const ctx = createMockContext(req);

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req.orgMembership).toEqual(membership);
  });

  it("should permit member when their role meets or exceeds requirement", async () => {
    const membership = {
      id: "mem-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "owner" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    orgsService.getMembership.mockResolvedValueOnce(membership);
    reflector.getAllAndOverride.mockReturnValueOnce(["admin"]); // Requires at least admin; owner has weight 50 >= 40

    const req: Partial<OrgAuthenticatedRequest> = {
      params: { id: "org-1" },
      user: { sub: "user-1", email: "ada@example.com" },
    };
    const ctx = createMockContext(req);

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it("should throw ForbiddenException when member role is below requirement", async () => {
    const membership = {
      id: "mem-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "developer" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    orgsService.getMembership.mockResolvedValueOnce(membership);
    reflector.getAllAndOverride.mockReturnValueOnce(["admin"]); // Developer (20) < Admin (40)

    const req: Partial<OrgAuthenticatedRequest> = {
      params: { id: "org-1" },
      user: { sub: "user-1", email: "ada@example.com" },
    };
    const ctx = createMockContext(req);

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      "You do not have sufficient permissions in this organization",
    );
  });

  it("should permit reviewer when requirement is translator", async () => {
    const membership = {
      id: "mem-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "reviewer" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    orgsService.getMembership.mockResolvedValueOnce(membership);
    reflector.getAllAndOverride.mockReturnValueOnce(["translator"]); // Reviewer (15) >= Translator (10)

    const req: Partial<OrgAuthenticatedRequest> = {
      params: { id: "org-1" },
      user: { sub: "user-1", email: "ada@example.com" },
    };
    const ctx = createMockContext(req);

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it("should reject translator when requirement is reviewer", async () => {
    const membership = {
      id: "mem-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "translator" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    orgsService.getMembership.mockResolvedValueOnce(membership);
    reflector.getAllAndOverride.mockReturnValueOnce(["reviewer"]); // Translator (10) < Reviewer (15)

    const req: Partial<OrgAuthenticatedRequest> = {
      params: { id: "org-1" },
      user: { sub: "user-1", email: "ada@example.com" },
    };
    const ctx = createMockContext(req);

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      "You do not have sufficient permissions in this organization",
    );
  });

  it("should permit translator when requirement is viewer", async () => {
    const membership = {
      id: "mem-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "translator" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    orgsService.getMembership.mockResolvedValueOnce(membership);
    reflector.getAllAndOverride.mockReturnValueOnce(["viewer"]); // Translator (10) >= Viewer (5)

    const req: Partial<OrgAuthenticatedRequest> = {
      params: { id: "org-1" },
      user: { sub: "user-1", email: "ada@example.com" },
    };
    const ctx = createMockContext(req);

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it("should reject viewer when requirement is translator", async () => {
    const membership = {
      id: "mem-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "viewer" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    orgsService.getMembership.mockResolvedValueOnce(membership);
    reflector.getAllAndOverride.mockReturnValueOnce(["translator"]); // Viewer (5) < Translator (10)

    const req: Partial<OrgAuthenticatedRequest> = {
      params: { id: "org-1" },
      user: { sub: "user-1", email: "ada@example.com" },
    };
    const ctx = createMockContext(req);

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      "You do not have sufficient permissions in this organization",
    );
  });
});
