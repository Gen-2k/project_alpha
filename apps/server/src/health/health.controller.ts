import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";

import { Public } from "../auth/public.decorator.js";
import { ApiErrorResponseDto } from "../common/dto/error-response.dto.js";
import {
  HealthStatusResponseDto,
  LivenessResponseDto,
  ReadinessResponseDto,
} from "./dto/health-response.dto.js";
import { HealthService } from "./health.service.js";

@ApiTags("health")
@Public()
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: "Service health probe",
    description:
      "Returns aggregated service health status including uptime, version, and database connection state.",
  })
  @ApiResponse({
    status: 200,
    type: HealthStatusResponseDto,
    description: "Overall service status.",
  })
  status() {
    return this.healthService.status();
  }

  @Get("live")
  @ApiOperation({
    summary: "Process liveness probe",
    description:
      "Confirms that the application process is running and actively processing HTTP traffic.",
  })
  @ApiResponse({ status: 200, type: LivenessResponseDto, description: "Process is responsive." })
  live() {
    return this.healthService.liveness();
  }

  @Get("ready")
  @ApiOperation({
    summary: "Database connectivity readiness probe",
    description:
      "Executes an active ping query against the PostgreSQL database to confirm service readiness.",
  })
  @ApiResponse({ status: 200, type: ReadinessResponseDto, description: "Database is reachable." })
  @ApiResponse({ status: 503, type: ApiErrorResponseDto, description: "Database is unreachable." })
  ready() {
    return this.healthService.ready();
  }
}
