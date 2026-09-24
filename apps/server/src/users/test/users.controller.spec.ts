import { beforeEach, describe, expect, it, vi } from "vitest";

import { UsersController } from "../users.controller.js";
import type { SafeUser, UsersService } from "../users.service.js";

describe("UsersController", () => {
  let controller: UsersController;
  let usersService: {
    findById: ReturnType<typeof vi.fn>;
  };

  const safeUser: SafeUser = {
    id: "user-1",
    email: "ada@example.com",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    usersService = {
      findById: vi.fn(() => Promise.resolve(safeUser)),
    };
    controller = new UsersController(usersService as unknown as UsersService);
  });

  it("should return the user profile for authenticated user", async () => {
    const req = { user: { sub: "user-1", email: "ada@example.com" } } as never;
    await expect(controller.me(req)).resolves.toEqual(safeUser);
    expect(usersService.findById).toHaveBeenCalledWith("user-1");
  });

  it("should throw NotFoundException if user is missing", async () => {
    usersService.findById.mockResolvedValueOnce(undefined);
    const req = { user: { sub: "user-unknown", email: "ada@example.com" } } as never;
    await expect(controller.me(req)).rejects.toThrow("User not found");
  });
});
