import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { AuthService } from "../auth.service.js";

@Injectable()
export class TokenCleanupTask {
  private readonly logger = new Logger(TokenCleanupTask.name);

  constructor(private readonly authService: AuthService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCleanup(): Promise<{ deleted: number }> {
    const result = await this.authService.cleanupExpiredTokens();
    if (result.deleted > 0) {
      this.logger.log(`Cleaned up ${String(result.deleted)} expired or revoked refresh tokens.`);
    }
    return result;
  }
}
