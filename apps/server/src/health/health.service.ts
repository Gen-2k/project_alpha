import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
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
  constructor(@Inject(DB) private readonly db: Db) {}

  liveness(): LivenessStatus {
    return {
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      version: "0.0.0",
    };
  }

  async ready(): Promise<ReadinessStatus> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return {
        status: "ok",
        database: "up",
      };
    } catch {
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
        version: "0.0.0",
        database: "up",
      };
    } catch {
      return {
        status: "degraded",
        uptimeSeconds: Math.floor(process.uptime()),
        version: "0.0.0",
        database: "down",
      };
    }
  }
}
