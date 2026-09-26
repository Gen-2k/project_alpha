import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MailService } from "../../mail/mail.service.js";
import { UsersController } from "../users.controller.js";
import type { SafeUser, UsersService } from "../users.service.js";

describe("UsersController", () => {
  let controller: UsersController;
  let usersService: {
    findById: ReturnType<typeof vi.fn>;
    findByIdWithHash: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mailService: {
    sendAccountDeletedNotification: ReturnType<typeof vi.fn>;
  };

  const safeUser: SafeUser = {
    id: "user-1",
    email: "ada@example.com",
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    usersService = {
      findById: vi.fn(() => Promise.resolve(safeUser)),
      findByIdWithHash: vi.fn(),
      delete: vi.fn(() => Promise.resolve()),
    };
    mailService = {
      sendAccountDeletedNotification: vi.fn(() => Promise.resolve()),
    };
    controller = new UsersController(
      usersService as unknown as UsersService,
      mailService as unknown as MailService,
    );
  });

  it("should return the user profile for authenticated user", async () => {
    const req = { user: { sub: "user-1", email: "ada@example.com" } } as never;
    await expect(controller.me(req)).resolves.toEqual(safeUser);
    expect(usersService.findById).toHaveBeenCalledWith("user-1");
  });

  it("should throw NotFoundException if user is missing", async () => {
    usersService.findById.mockResolvedValueOnce(undefined);
    const req = { user: { sub: "user-unknown", email: "ada@example.com" } } as never;
    await expect(controller.me(req)).rejects.toThrow("User profile not found");
  });

  describe("deleteMe", () => {
    it("should delete user, send notification, and clear cookie when password is correct", async () => {
      const passwordHash = await bcrypt.hash("correct-horse", 10);
      usersService.findByIdWithHash.mockResolvedValueOnce({
        ...safeUser,
        passwordHash,
      });

      const clearCookie = vi.fn();
      const req = { user: { sub: "user-1", email: "ada@example.com" } } as never;
      const res = { clearCookie } as never;

      const result = await controller.deleteMe({ password: "correct-horse" }, req, res);
      expect(result).toEqual({
        deleted: true,
        message: "Your account and all associated data have been permanently deleted.",
      });
      expect(mailService.sendAccountDeletedNotification).toHaveBeenCalledWith("ada@example.com");
      expect(usersService.delete).toHaveBeenCalledWith("user-1");
      expect(clearCookie).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException if password is incorrect", async () => {
      const passwordHash = await bcrypt.hash("correct-horse", 10);
      usersService.findByIdWithHash.mockResolvedValueOnce({
        ...safeUser,
        passwordHash,
      });

      const clearCookie = vi.fn();
      const req = { user: { sub: "user-1", email: "ada@example.com" } } as never;
      const res = { clearCookie } as never;

      await expect(controller.deleteMe({ password: "wrong-horse" }, req, res)).rejects.toThrow(
        "The password provided is incorrect",
      );
      expect(usersService.delete).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException if user to delete is missing", async () => {
      usersService.findByIdWithHash.mockResolvedValueOnce(undefined);
      const req = { user: { sub: "user-unknown", email: "ada@example.com" } } as never;
      const res = { clearCookie: vi.fn() } as never;

      await expect(controller.deleteMe({ password: "any-password" }, req, res)).rejects.toThrow(
        "User profile not found",
      );
    });
  });
});
