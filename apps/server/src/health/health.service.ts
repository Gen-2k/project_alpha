import { Inject, Injectable, Logger, Optional, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Db } from "@repo/database/client";
import { DB } from "@repo/database/client";
import { sql } from "drizzle-orm";

export interface LivenessStatus {
  status: "ok";
  uptimeSeconds: number;
  version: string;
}

export interface ReadinessStatus {
  status: "ok";
  database: "up";
}

export interface HealthStatus {
  status: "ok" | "degraded";
  uptimeSeconds: number;
  version: string;
  database: "up" | "down";
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly version: string;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Optional() configService?: ConfigService,
  ) {
    // Optional so unit tests can construct with only a DB stub; in the app
    // ConfigModule is global and always provides the validated APP_VERSION.
    this.version = configService?.get<string>("APP_VERSION") ?? "0.0.0";
  }

  liveness(): LivenessStatus {
    return {
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      version: this.version,
    };
  }

  async ready(): Promise<ReadinessStatus> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return {
        status: "ok",
        database: "up",
      };
    } catch (err) {
      this.logger.warn(`Readiness probe failed: database unreachable: ${String(err)}`);
      throw new ServiceUnavailableException({
        status: "error",
        database: "down",
      });
    }
  }

  async status(): Promise<HealthStatus> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return {
        status: "ok",
        uptimeSeconds: Math.floor(process.uptime()),
        version: this.version,
        database: "up",
      };
    } catch (err) {
      this.logger.warn(`Health status degraded: database unreachable: ${String(err)}`);
      return {
        status: "degraded",
        uptimeSeconds: Math.floor(process.uptime()),
        version: this.version,
        database: "down",
      };
    }
  }
}
