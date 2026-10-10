import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { AuthService } from "../auth.service.js";

@Injectable()
export class TokenCleanupTask {
  private readonly logger = new Logger(TokenCleanupTask.name);

  constructor(private readonly authService: AuthService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCleanup(): Promise<{
    tokensDeleted: number;
    unverifiedUsersDeleted: number;
    verificationTokensDeleted: number;
    passwordResetTokensDeleted: number;
  }> {
    const tokensResult = await this.authService.cleanupExpiredTokens();
    if (tokensResult.deleted > 0) {
      this.logger.log(
        `Cleaned up ${String(tokensResult.deleted)} expired or revoked refresh tokens.`,
      );
    }

    const unverifiedResult = await this.authService.cleanupUnverifiedUsers();
    if (unverifiedResult.deleted > 0) {
      this.logger.log(
        `Cleaned up ${String(unverifiedResult.deleted)} abandoned unverified user accounts.`,
      );
    }

    const verificationTokensResult = await this.authService.cleanupExpiredVerificationTokens();
    if (verificationTokensResult.deleted > 0) {
      this.logger.log(
        `Cleaned up ${String(verificationTokensResult.deleted)} expired email verification tokens.`,
      );
    }

    const passwordResetResult = await this.authService.cleanupExpiredPasswordResetTokens();
    if (passwordResetResult.deleted > 0) {
      this.logger.log(
        `Cleaned up ${String(passwordResetResult.deleted)} expired password reset tokens.`,
      );
    }

    return {
      tokensDeleted: tokensResult.deleted,
      unverifiedUsersDeleted: unverifiedResult.deleted,
      verificationTokensDeleted: verificationTokensResult.deleted,
      passwordResetTokensDeleted: passwordResetResult.deleted,
    };
  }
}
