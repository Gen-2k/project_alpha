import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Db } from "@repo/database/client";
import type { NewUser, User } from "@repo/database/schema";
import type { SafeUser } from "@repo/validation/auth";
import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";

import type { MailService } from "../../mail/mail.service.js";
import type { UsersService } from "../../users/users.service.js";
import { AddMemberDto } from "../dto/add-member.dto.js";
import { OrganizationsService } from "../organizations.service.js";

const mockOrg = {
  id: "org-1",
  name: "Acme Corp",
  slug: "acme-corp",
  planTier: "free",
  createdAt: new Date("2026-10-04T00:00:00.000Z"),
  updatedAt: new Date("2026-10-04T00:00:00.000Z"),
};

const mockMember = {
  id: "member-1",
  organizationId: "org-1",
  userId: "user-1",
  role: "owner" as const,
  createdAt: new Date("2026-10-04T00:00:00.000Z"),
  updatedAt: new Date("2026-10-04T00:00:00.000Z"),
};

const mockSafeUser: SafeUser = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  locale: "en-US",
  timezone: "UTC",
  countryCode: "US",
  avatarUrl: null,
  emailVerifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testPasswordHash = bcrypt.hashSync("SecurePassword123!", 4);

const mockUserWithHash: User = {
  ...mockSafeUser,
  passwordHash: testPasswordHash,
};

const mockInvitation = {
  id: "inv-1",
  organizationId: "org-1",
  email: "invitee@example.com",
  role: "developer" as const,
  invitedByUserId: "user-1",
  tokenHash: "hashed-token",
  expiresAt: new Date(Date.now() + 7 * 86400000),
  acceptedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockDb(options?: {
  selectRows?: unknown[];
  selectRowsQueue?: unknown[][];
  insertRows?: unknown[];
  insertError?: Error;
  updateRows?: unknown[];
  updateError?: Error;
  deleteError?: Error;
}) {
  const insertedItems: unknown[] = [];
  const updatedItems: unknown[] = [];
  const transactionSpy = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(db));
  const selectQueue = options?.selectRowsQueue ? [...options.selectRowsQueue] : undefined;

  const createQuery = () => {
    const nextRows =
      selectQueue && selectQueue.length > 0
        ? selectQueue.shift()
        : (options?.selectRows ?? [mockOrg]);
    const resultPromise = Promise.resolve(nextRows);
    return Object.assign(resultPromise, {
      for: () => resultPromise,
    });
  };

  const createJoin = (): {
    innerJoin: () => unknown;
    leftJoin: () => unknown;
    where: () => unknown;
  } => ({
    innerJoin: () => createJoin(),
    leftJoin: () => createJoin(),
    where: () => createQuery(),
  });

  const db = {
    transaction: transactionSpy,
    select: vi.fn(() => ({
      from: () => ({
        where: () => createQuery(),
        innerJoin: () => createJoin(),
        leftJoin: () => createJoin(),
      }),
    })),
    insert: vi.fn(() => ({
      values: (values: unknown) => {
        insertedItems.push(values);
        const resultPromise = options?.insertError
          ? Promise.reject(options.insertError)
          : Promise.resolve(options?.insertRows ?? [mockOrg]);
        return Object.assign(resultPromise, {
          returning: () => resultPromise,
        });
      },
    })),
    update: vi.fn(() => ({
      set: (values?: unknown) => {
        if (values !== undefined) {
          updatedItems.push(values);
        }
        return {
          where: () => {
            const resultPromise = options?.updateError
              ? Promise.reject(options.updateError)
              : Promise.resolve(options?.updateRows ?? [mockOrg]);
            return Object.assign(resultPromise, {
              returning: () => resultPromise,
            });
          },
        };
      },
    })),
    delete: vi.fn(() => ({
      where: () => (options?.deleteError ? Promise.reject(options.deleteError) : Promise.resolve()),
    })),
  };
  return { db: db as unknown as Db, insertedItems, updatedItems, transactionSpy };
}

function createMockUsersService(overrides?: {
  findByEmail?: (email: string) => Promise<SafeUser | undefined>;
  findById?: (id: string) => Promise<SafeUser | undefined>;
  findByEmailWithHash?: (email: string) => Promise<User | undefined>;
  create?: (input: NewUser, executor?: unknown) => Promise<SafeUser>;
}) {
  return {
    findByEmail: vi.fn(overrides?.findByEmail ?? (() => Promise.resolve(mockSafeUser))),
    findById: vi.fn(overrides?.findById ?? (() => Promise.resolve(mockSafeUser))),
    findByEmailWithHash: vi.fn(
      overrides?.findByEmailWithHash ?? (() => Promise.resolve(mockUserWithHash)),
    ),
    create: vi.fn(
      overrides?.create ??
        ((input: NewUser) =>
          Promise.resolve({
            id: "user-new",
            email: input.email,
            name: input.name ?? null,
            locale: "en-US",
            timezone: "UTC",
            countryCode: "US",
            avatarUrl: null,
            emailVerifiedAt: input.emailVerifiedAt ? new Date(input.emailVerifiedAt) : null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
    ),
  } as unknown as UsersService;
}

describe("OrganizationsService", () => {
  const usersService = createMockUsersService();

  describe("create", () => {
    it("should create organization and assign creator as owner in transaction", async () => {
      const { db, insertedItems } = createMockDb({ insertRows: [mockOrg] });
      const service = new OrganizationsService(db, usersService);

      const result = await service.create("user-1", { name: "Acme Corp" });
      expect(result).toEqual(mockOrg);
      expect(insertedItems).toHaveLength(2);
      expect(insertedItems[1]).toEqual({
        organizationId: "org-1",
        userId: "user-1",
        role: "owner",
      });
    });

    it("should handle custom slug in create", async () => {
      const { db, insertedItems } = createMockDb({ insertRows: [mockOrg] });
      const service = new OrganizationsService(db, usersService);

      await service.create("user-1", { name: "Acme Corp", slug: "custom-slug" });
      expect(insertedItems[0]).toEqual({
        name: "Acme Corp",
        slug: "custom-slug",
      });
    });

    it("should map unique violation code 23505 to ConflictException", async () => {
      const uniqueError = Object.assign(new Error("duplicate key"), { code: "23505" });
      const { db } = createMockDb({ insertError: uniqueError });
      const service = new OrganizationsService(db, usersService);

      await expect(service.create("user-1", { name: "Acme Corp" })).rejects.toThrow(
        ConflictException,
      );
    });

    it("should throw error if inserting organization returns no row", async () => {
      const { db } = createMockDb({ insertRows: [] });
      const service = new OrganizationsService(db, usersService);

      await expect(service.create("user-1", { name: "Acme Corp" })).rejects.toThrow(
        "Failed to create organization record",
      );
    });

    it("should rethrow non-unique database errors", async () => {
      const genericError = new Error("Connection failed");
      const { db } = createMockDb({ insertError: genericError });
      const service = new OrganizationsService(db, usersService);

      await expect(service.create("user-1", { name: "Acme Corp" })).rejects.toThrow(
        "Connection failed",
      );
    });
  });

  describe("listForUser", () => {
    it("should return organizations user belongs to", async () => {
      const expectedRows = [{ organization: mockOrg, role: "owner" }];
      const { db } = createMockDb({ selectRows: expectedRows });
      const service = new OrganizationsService(db, usersService);

      const result = await service.listForUser("user-1");
      expect(result).toEqual(expectedRows);
    });
  });

  describe("findById & findBySlug", () => {
    it("should return organization by id", async () => {
      const { db } = createMockDb({ selectRows: [mockOrg] });
      const service = new OrganizationsService(db, usersService);

      const result = await service.findById("org-1");
      expect(result).toEqual(mockOrg);
    });

    it("should return organization by slug", async () => {
      const { db } = createMockDb({ selectRows: [mockOrg] });
      const service = new OrganizationsService(db, usersService);

      const result = await service.findBySlug("acme-corp");
      expect(result).toEqual(mockOrg);
    });
  });

  describe("getMembership", () => {
    it("should return membership when present", async () => {
      const { db } = createMockDb({ selectRows: [mockMember] });
      const service = new OrganizationsService(db, usersService);

      const result = await service.getMembership("org-1", "user-1");
      expect(result).toEqual(mockMember);
    });

    it("should return undefined when membership is absent", async () => {
      const { db } = createMockDb({ selectRows: [] });
      const service = new OrganizationsService(db, usersService);

      const result = await service.getMembership("org-1", "user-unknown");
      expect(result).toBeUndefined();
    });
  });

  describe("update", () => {
    it("should update organization metadata", async () => {
      const updatedOrg = { ...mockOrg, name: "Acme Global" };
      const { db } = createMockDb({ updateRows: [updatedOrg] });
      const service = new OrganizationsService(db, usersService);

      const result = await service.update("org-1", { name: "Acme Global" });
      expect(result).toEqual(updatedOrg);
    });

    it("should throw NotFoundException if organization not found", async () => {
      const { db } = createMockDb({ updateRows: [] });
      const service = new OrganizationsService(db, usersService);

      await expect(service.update("unknown", { name: "New" })).rejects.toThrow(NotFoundException);
    });

    it("should throw ConflictException on slug collision", async () => {
      const uniqueError = Object.assign(new Error("duplicate key"), { code: "23505" });
      const { db } = createMockDb({ updateError: uniqueError });
      const service = new OrganizationsService(db, usersService);

      await expect(service.update("org-1", { slug: "collision" })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("delete", () => {
    it("should delete existing organization", async () => {
      const { db } = createMockDb({ selectRows: [mockOrg] });
      const service = new OrganizationsService(db, usersService);

      await expect(service.delete("org-1")).resolves.toBeUndefined();
    });

    it("should throw NotFoundException if organization does not exist", async () => {
      const { db } = createMockDb({ selectRows: [] });
      const service = new OrganizationsService(db, usersService);

      await expect(service.delete("org-unknown")).rejects.toThrow(NotFoundException);
    });
  });

  describe("listMembers", () => {
    it("should return members with user details", async () => {
      const memberWithUser = {
        ...mockMember,
        user: {
          id: mockSafeUser.id,
          email: mockSafeUser.email,
          name: mockSafeUser.name,
          avatarUrl: mockSafeUser.avatarUrl,
        },
      };
      const { db } = createMockDb({ selectRows: [memberWithUser] });
      const service = new OrganizationsService(db, usersService);

      const result = await service.listMembers("org-1");
      expect(result).toEqual([memberWithUser]);
    });
  });

  describe("addMember", () => {
    it("should add user by email", async () => {
      const { db } = createMockDb({
        selectRows: [], // no existing membership
        insertRows: [mockMember],
      });
      const service = new OrganizationsService(db, usersService);

      const result = await service.addMember("org-1", {
        email: "ada@example.com",
        role: "developer",
      });
      expect(result.id).toBe(mockMember.id);
      expect(result.user?.email).toBe("ada@example.com");
    });

    it("should throw NotFoundException if user email does not exist", async () => {
      const localUsersService = {
        findByEmail: vi.fn().mockResolvedValueOnce(undefined),
      } as unknown as UsersService;
      const { db } = createMockDb();
      const service = new OrganizationsService(db, localUsersService);

      await expect(
        service.addMember("org-1", { email: "ghost@example.com", role: "developer" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ConflictException if user is already a member", async () => {
      const { db } = createMockDb({ selectRows: [mockMember] }); // existing member
      const service = new OrganizationsService(db, usersService);

      await expect(
        service.addMember("org-1", { email: "ada@example.com", role: "developer" }),
      ).rejects.toThrow(ConflictException);
    });
    it("should allow PM to add member with lower role", async () => {
      const { db } = createMockDb({
        selectRows: [],
        insertRows: [mockMember],
      });
      const service = new OrganizationsService(db, usersService);

      const result = await service.addMember(
        "org-1",
        { email: "ada@example.com", role: "translator" },
        "project_manager",
      );
      expect(result.id).toBe(mockMember.id);
    });

    it("should throw ForbiddenException if PM attempts to assign equal or higher role", async () => {
      const { db } = createMockDb();
      const service = new OrganizationsService(db, usersService);

      await expect(
        service.addMember("org-1", { email: "ada@example.com", role: "admin" }, "project_manager"),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.addMember(
          "org-1",
          { email: "ada@example.com", role: "project_manager" },
          "project_manager",
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw error if inserting membership returns no row", async () => {
      const { db } = createMockDb({ selectRows: [], insertRows: [] });
      const service = new OrganizationsService(db, usersService);

      await expect(
        service.addMember("org-1", { email: "ada@example.com", role: "developer" }, "owner"),
      ).rejects.toThrow("Failed to create membership record");
    });

    it("should initialize AddMemberDto with default developer role", () => {
      const dto = new AddMemberDto();
      expect(dto.role).toBe("developer");
    });

    it("should dispatch member added notification when mailService is provided", async () => {
      const { db } = createMockDb({
        selectRowsQueue: [
          [], // getMembership: not existing
          [mockOrg], // findById in mail step
        ],
        insertRows: [mockMember],
      });
      const sendMemberNotification = vi.fn(() => Promise.resolve());
      const mailService = {
        sendMemberAddedNotification: sendMemberNotification,
      } as unknown as MailService;
      const service = new OrganizationsService(db, usersService, mailService);

      await service.addMember(
        "org-1",
        { email: "ada@example.com", role: "developer" },
        "owner",
        "user-1",
      );

      expect(sendMemberNotification).toHaveBeenCalledWith("ada@example.com", {
        organizationName: mockOrg.name,
        adderName: mockSafeUser.name,
        role: "developer",
      });
    });

    it("should catch and log error if mailService.sendMemberAddedNotification rejects", async () => {
      const { db } = createMockDb({
        selectRowsQueue: [
          [], // getMembership
          [mockOrg], // findById
        ],
        insertRows: [mockMember],
      });
      const mailService = {
        sendMemberAddedNotification: vi.fn(() => Promise.reject(new Error("SMTP down"))),
      } as unknown as MailService;
      const service = new OrganizationsService(db, usersService, mailService);

      const result = await service.addMember(
        "org-1",
        { email: "ada@example.com", role: "developer" },
        "owner",
      );

      expect(result.id).toBe(mockMember.id);
    });
  });

  describe("updateMemberRole", () => {
    it("should update role of a member", async () => {
      const devMember = { ...mockMember, role: "developer" as const };
      const updatedMember = { ...mockMember, role: "admin" as const };
      const { db, transactionSpy } = createMockDb({
        selectRows: [devMember],
        updateRows: [updatedMember],
      });
      const service = new OrganizationsService(db, usersService);

      const result = await service.updateMemberRole("org-1", "member-1", "admin");
      expect(result.role).toBe("admin");
      expect(transactionSpy).toHaveBeenCalled();
    });

    it("should throw ForbiddenException if PM attempts to promote member to equal or higher role", async () => {
      const devMember = { ...mockMember, role: "developer" as const };
      const { db } = createMockDb({ selectRows: [devMember] });
      const service = new OrganizationsService(db, usersService);

      await expect(
        service.updateMemberRole("org-1", "member-1", "admin", "project_manager"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException if PM attempts to modify a member with equal or higher role", async () => {
      const adminMember = { ...mockMember, role: "admin" as const };
      const { db } = createMockDb({ selectRows: [adminMember] });
      const service = new OrganizationsService(db, usersService);

      await expect(
        service.updateMemberRole("org-1", "member-1", "translator", "project_manager"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException when demoting the only owner", async () => {
      const { db } = createMockDb({
        selectRows: [mockMember], // member found, and owners.length = 1
      });
      const service = new OrganizationsService(db, usersService);

      await expect(service.updateMemberRole("org-1", "member-1", "developer")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw NotFoundException if member not found", async () => {
      const { db } = createMockDb({ selectRows: [] });
      const service = new OrganizationsService(db, usersService);

      await expect(service.updateMemberRole("org-1", "unknown", "admin")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw NotFoundException if updating member returns no row", async () => {
      const devMember = { ...mockMember, role: "developer" as const };
      const { db } = createMockDb({
        selectRows: [devMember],
        updateRows: [],
      });
      const service = new OrganizationsService(db, usersService);

      await expect(service.updateMemberRole("org-1", "member-1", "admin", "owner")).rejects.toThrow(
        "Failed to update organization member",
      );
    });
  });

  describe("removeMember", () => {
    it("should remove non-owner member", async () => {
      const devMember = { ...mockMember, role: "developer" as const };
      const { db, transactionSpy } = createMockDb({ selectRows: [devMember] });
      const service = new OrganizationsService(db, usersService);

      await expect(service.removeMember("org-1", "member-1")).resolves.toBeUndefined();
      expect(transactionSpy).toHaveBeenCalled();
    });

    it("should throw ForbiddenException if PM attempts to remove admin", async () => {
      const adminMember = { ...mockMember, role: "admin" as const };
      const { db } = createMockDb({ selectRows: [adminMember] });
      const service = new OrganizationsService(db, usersService);

      await expect(
        service.removeMember("org-1", "member-1", "project_manager", false),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should allow PM to remove a member with lower role", async () => {
      const translatorMember = { ...mockMember, role: "translator" as const };
      const { db } = createMockDb({ selectRows: [translatorMember] });
      const service = new OrganizationsService(db, usersService);

      await expect(
        service.removeMember("org-1", "member-1", "project_manager", false),
      ).resolves.toBeUndefined();
    });

    it("should throw BadRequestException when removing the only owner", async () => {
      const { db } = createMockDb({ selectRows: [mockMember] });
      const service = new OrganizationsService(db, usersService);

      await expect(service.removeMember("org-1", "member-1")).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException if member does not exist", async () => {
      const { db } = createMockDb({ selectRows: [] });
      const service = new OrganizationsService(db, usersService);

      await expect(service.removeMember("org-1", "unknown")).rejects.toThrow(NotFoundException);
    });
  });

  describe("createInvitation", () => {
    it("should throw ForbiddenException if actor role is lower or equal to invited role", async () => {
      const { db } = createMockDb();
      const service = new OrganizationsService(db, usersService);

      await expect(
        service.createInvitation("org-1", "user-1", "project_manager", {
          email: "new@example.com",
          role: "admin",
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.createInvitation("org-1", "user-1", "developer", {
          email: "new@example.com",
          role: "developer",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException if organization does not exist", async () => {
      const { db } = createMockDb({
        selectRowsQueue: [
          [], // findById returns undefined
        ],
      });
      const service = new OrganizationsService(db, usersService);

      await expect(
        service.createInvitation("org-unknown", "user-1", "owner", {
          email: "new@example.com",
          role: "developer",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ConflictException if user is already a member", async () => {
      const { db } = createMockDb({
        selectRowsQueue: [
          [mockOrg], // findById
          [mockMember], // existingMember check
        ],
      });
      const service = new OrganizationsService(db, usersService);

      await expect(
        service.createInvitation("org-1", "user-1", "owner", {
          email: "ada@example.com",
          role: "developer",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should create a new invitation, dispatch email, and return the record", async () => {
      const localUsersService = createMockUsersService({
        findByEmail: () => Promise.resolve(undefined),
        findById: () => Promise.resolve(mockSafeUser),
      });

      const { db, insertedItems } = createMockDb({
        selectRowsQueue: [
          [mockOrg], // findById
          [], // existingInvite check
        ],
        insertRows: [mockInvitation],
      });

      const sendInviteEmail = vi.fn(() => Promise.resolve());
      const mailService = {
        sendOrganizationInvitationEmail: sendInviteEmail,
      } as unknown as MailService;

      const service = new OrganizationsService(db, localUsersService, mailService);

      const result = await service.createInvitation("org-1", "user-1", "owner", {
        email: "invitee@example.com",
        role: "developer",
      });

      expect(result).toEqual(mockInvitation);
      expect(insertedItems).toHaveLength(1);
      expect(sendInviteEmail).toHaveBeenCalledWith(
        "invitee@example.com",
        expect.objectContaining({
          organizationName: mockOrg.name,
          inviterName: mockSafeUser.name,
          role: "developer",
          expiresInDays: 7,
        }),
      );
    });

    it("should update existing pending invitation if one exists", async () => {
      const localUsersService = createMockUsersService({
        findByEmail: () => Promise.resolve(undefined),
        findById: () => Promise.resolve(undefined),
      });

      const updatedInvite = { ...mockInvitation, role: "admin" as const };
      const { db, updatedItems } = createMockDb({
        selectRowsQueue: [
          [mockOrg], // findById
          [mockInvitation], // existingInvite found
        ],
        updateRows: [updatedInvite],
      });

      const sendInviteEmail = vi.fn(() => Promise.resolve());
      const mailService = {
        sendOrganizationInvitationEmail: sendInviteEmail,
      } as unknown as MailService;

      const service = new OrganizationsService(db, localUsersService, mailService);

      const result = await service.createInvitation("org-1", "user-1", "owner", {
        email: "invitee@example.com",
        role: "admin",
      });

      expect(result).toEqual(updatedInvite);
      expect(updatedItems).toHaveLength(1);
      expect(sendInviteEmail).toHaveBeenCalledWith(
        "invitee@example.com",
        expect.objectContaining({
          inviterEmail: "An administrator",
        }),
      );
    });

    it("should throw error if update existing invitation returns no row", async () => {
      const localUsersService = createMockUsersService({
        findByEmail: () => Promise.resolve(undefined),
      });

      const { db } = createMockDb({
        selectRowsQueue: [[mockOrg], [mockInvitation]],
        updateRows: [],
      });

      const service = new OrganizationsService(db, localUsersService);

      await expect(
        service.createInvitation("org-1", "user-1", "owner", {
          email: "invitee@example.com",
          role: "developer",
        }),
      ).rejects.toThrow("Failed to update invitation");
    });

    it("should throw error if insert new invitation returns no row", async () => {
      const localUsersService = createMockUsersService({
        findByEmail: () => Promise.resolve(undefined),
      });

      const { db } = createMockDb({
        selectRowsQueue: [[mockOrg], []],
        insertRows: [],
      });

      const service = new OrganizationsService(db, localUsersService);

      await expect(
        service.createInvitation("org-1", "user-1", "owner", {
          email: "invitee@example.com",
          role: "developer",
        }),
      ).rejects.toThrow("Failed to create invitation");
    });

    it("should survive mailService failure and still return invitation", async () => {
      const localUsersService = createMockUsersService({
        findByEmail: () => Promise.resolve(undefined),
        findById: () => Promise.resolve(mockSafeUser),
      });

      const { db } = createMockDb({
        selectRowsQueue: [[mockOrg], []],
        insertRows: [mockInvitation],
      });

      const mailService = {
        sendOrganizationInvitationEmail: vi.fn(() => Promise.reject(new Error("SMTP down"))),
      } as unknown as MailService;

      const service = new OrganizationsService(db, localUsersService, mailService);

      const result = await service.createInvitation("org-1", "user-1", "owner", {
        email: "invitee@example.com",
        role: "developer",
      });

      expect(result).toEqual(mockInvitation);
    });
  });

  describe("listInvitations", () => {
    it("should return pending invitations for organization", async () => {
      const { db } = createMockDb({ selectRows: [mockInvitation] });
      const service = new OrganizationsService(db, usersService);

      const result = await service.listInvitations("org-1");
      expect(result).toEqual([mockInvitation]);
    });
  });

  describe("revokeInvitation", () => {
    it("should revoke invitation when found", async () => {
      const { db } = createMockDb({ selectRows: [mockInvitation] });
      const service = new OrganizationsService(db, usersService);

      await expect(service.revokeInvitation("org-1", "inv-1")).resolves.toBeUndefined();
    });

    it("should throw NotFoundException if invitation does not exist", async () => {
      const { db } = createMockDb({ selectRows: [] });
      const service = new OrganizationsService(db, usersService);

      await expect(service.revokeInvitation("org-1", "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getInvitationByToken", () => {
    it("should return invitation details when token matches", async () => {
      const details = {
        organizationId: "org-1",
        organizationName: "Acme Corp",
        email: "invitee@example.com",
        role: "developer" as const,
        inviterName: "Ada Lovelace",
        inviterEmail: "ada@example.com",
        expiresAt: new Date(Date.now() + 86400000),
      };
      const { db } = createMockDb({ selectRows: [details] });
      const service = new OrganizationsService(db, usersService);

      const result = await service.getInvitationByToken("valid-token");
      expect(result).toEqual(details);
    });

    it("should throw NotFoundException if token is invalid or expired", async () => {
      const { db } = createMockDb({ selectRows: [] });
      const service = new OrganizationsService(db, usersService);

      await expect(service.getInvitationByToken("invalid-token")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("acceptInvitation", () => {
    it("should throw BadRequestException if invitation not found or expired", async () => {
      const { db } = createMockDb({ selectRows: [] });
      const service = new OrganizationsService(db, usersService);

      await expect(
        service.acceptInvitation("bad-token", { password: "Password123!" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should accept invitation for authenticated user with matching email", async () => {
      const { db } = createMockDb({
        selectRowsQueue: [
          [mockInvitation], // invite found
          [], // not already member
        ],
      });
      const localUsersService = createMockUsersService({
        findById: () => Promise.resolve({ ...mockSafeUser, email: mockInvitation.email }),
      });
      const service = new OrganizationsService(db, localUsersService);

      const result = await service.acceptInvitation("valid-token", {}, "user-1");
      expect(result).toEqual({
        organizationId: "org-1",
        message: "Invitation accepted successfully",
      });
    });

    it("should accept invitation for authenticated user who is already a member without re-inserting", async () => {
      const { db, insertedItems } = createMockDb({
        selectRowsQueue: [
          [mockInvitation], // invite found
          [mockMember], // already member
        ],
      });
      const localUsersService = createMockUsersService({
        findById: () => Promise.resolve({ ...mockSafeUser, email: mockInvitation.email }),
      });
      const service = new OrganizationsService(db, localUsersService);

      const result = await service.acceptInvitation("valid-token", {}, "user-1");
      expect(result).toEqual({
        organizationId: "org-1",
        message: "Invitation accepted successfully",
      });
      expect(insertedItems).toHaveLength(0);
    });

    it("should throw NotFoundException if authenticated user does not exist", async () => {
      const { db } = createMockDb({ selectRowsQueue: [[mockInvitation]] });
      const localUsersService = createMockUsersService({
        findById: () => Promise.resolve(undefined),
      });
      const service = new OrganizationsService(db, localUsersService);

      await expect(service.acceptInvitation("valid-token", {}, "ghost-user")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw ForbiddenException if authenticated user email does not match invite", async () => {
      const { db } = createMockDb({ selectRowsQueue: [[mockInvitation]] });
      const localUsersService = createMockUsersService({
        findById: () => Promise.resolve({ ...mockSafeUser, email: "other@example.com" }),
      });
      const service = new OrganizationsService(db, localUsersService);

      await expect(service.acceptInvitation("valid-token", {}, "user-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should require password for unauthenticated existing user", async () => {
      const { db } = createMockDb({ selectRowsQueue: [[mockInvitation]] });
      const localUsersService = createMockUsersService({
        findByEmailWithHash: () => Promise.resolve(mockUserWithHash),
      });
      const service = new OrganizationsService(db, localUsersService);

      await expect(service.acceptInvitation("valid-token", {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should reject unauthenticated existing user with incorrect password", async () => {
      const { db } = createMockDb({ selectRowsQueue: [[mockInvitation]] });
      const localUsersService = createMockUsersService({
        findByEmailWithHash: () => Promise.resolve(mockUserWithHash),
      });
      const service = new OrganizationsService(db, localUsersService);

      await expect(
        service.acceptInvitation("valid-token", { password: "WrongPassword!" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should accept invitation for unauthenticated existing user with correct password", async () => {
      const { db, insertedItems } = createMockDb({
        selectRowsQueue: [
          [mockInvitation],
          [], // not already member
        ],
      });
      const localUsersService = createMockUsersService({
        findByEmailWithHash: () => Promise.resolve(mockUserWithHash),
      });
      const service = new OrganizationsService(db, localUsersService);

      const result = await service.acceptInvitation("valid-token", {
        password: "SecurePassword123!",
      });
      expect(result).toEqual({
        organizationId: "org-1",
        message: "Invitation accepted successfully",
      });
      expect(insertedItems).toHaveLength(1);
    });

    it("should require password for unauthenticated new user", async () => {
      const { db } = createMockDb({ selectRowsQueue: [[mockInvitation]] });
      const localUsersService = createMockUsersService({
        findByEmailWithHash: () => Promise.resolve(undefined),
      });
      const service = new OrganizationsService(db, localUsersService);

      await expect(service.acceptInvitation("valid-token", { name: "New User" })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should create new account and accept invitation for unauthenticated new user", async () => {
      const { db, insertedItems } = createMockDb({
        selectRowsQueue: [
          [mockInvitation],
          [], // not already member
        ],
      });
      const createSpy = vi.fn((input: NewUser) =>
        Promise.resolve({
          ...mockSafeUser,
          id: "user-brand-new",
          email: input.email,
          name: input.name ?? null,
        }),
      );
      const localUsersService = createMockUsersService({
        findByEmailWithHash: () => Promise.resolve(undefined),
        create: createSpy,
      });
      const service = new OrganizationsService(db, localUsersService);

      const result = await service.acceptInvitation("valid-token", {
        name: "New Invitee",
        password: "Password123!",
      });

      expect(result).toEqual({
        organizationId: "org-1",
        message: "Invitation accepted successfully",
      });
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockInvitation.email,
          name: "New Invitee",
        }),
        db,
      );
      expect(createSpy.mock.calls[0]?.[0]?.emailVerifiedAt).toBeInstanceOf(Date);
      expect(insertedItems).toHaveLength(1);
    });
  });
});
