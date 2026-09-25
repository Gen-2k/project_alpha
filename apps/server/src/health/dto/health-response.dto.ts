import { ApiProperty } from "@nestjs/swagger";

import type { HealthStatus, LivenessStatus, ReadinessStatus } from "../health.service.js";

export class LivenessResponseDto implements LivenessStatus {
  @ApiProperty({ example: "ok", description: "Process responsiveness confirmation" })
  status!: "ok";

  @ApiProperty({ example: 42, description: "Process uptime in seconds" })
  uptimeSeconds!: number;

  @ApiProperty({ example: "0.0.0", description: "Server application version" })
  version!: string;
}

export class ReadinessResponseDto implements ReadinessStatus {
  @ApiProperty({ example: "ok", description: "Service readiness confirmation" })
  status!: "ok";

  @ApiProperty({ example: "up", description: "PostgreSQL database connectivity state" })
  database!: "up";
}

export class HealthStatusResponseDto implements HealthStatus {
  @ApiProperty({ example: "ok", enum: ["ok", "degraded"], description: "Overall health status" })
  status!: "ok" | "degraded";

  @ApiProperty({ example: 42, description: "Process uptime in seconds" })
  uptimeSeconds!: number;

  @ApiProperty({ example: "0.0.0", description: "Server application version" })
  version!: string;

  @ApiProperty({ example: "up", enum: ["up", "down"], description: "PostgreSQL database status" })
  database!: "up" | "down";
}
