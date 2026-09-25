import { Logger } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthService } from "../../auth.service.js";
import { TokenCleanupTask } from "../token-cleanup.task.js";

describe("TokenCleanupTask", () => {
  let task: TokenCleanupTask;
  let authService: {
    cleanupExpiredTokens: ReturnType<typeof vi.fn>;
  };
  let loggerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = {
      cleanupExpiredTokens: vi.fn(),
    };
    task = new TokenCleanupTask(authService as unknown as AuthService);
    loggerSpy = vi.spyOn(Logger.prototype, "log").mockReturnValue();
  });

  it("should trigger cleanup and log when tokens are deleted", async () => {
    authService.cleanupExpiredTokens.mockResolvedValueOnce({ deleted: 5 });

    const result = await task.handleCleanup();

    expect(authService.cleanupExpiredTokens).toHaveBeenCalledOnce();
    expect(result).toEqual({ deleted: 5 });
    expect(loggerSpy).toHaveBeenCalledWith("Cleaned up 5 expired or revoked refresh tokens.");
  });

  it("should trigger cleanup without logging when zero tokens are deleted", async () => {
    authService.cleanupExpiredTokens.mockResolvedValueOnce({ deleted: 0 });

    const result = await task.handleCleanup();

    expect(authService.cleanupExpiredTokens).toHaveBeenCalledOnce();
    expect(result).toEqual({ deleted: 0 });
    expect(loggerSpy).not.toHaveBeenCalled();
  });
});
