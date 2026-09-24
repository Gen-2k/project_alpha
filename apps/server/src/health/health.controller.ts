import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "../auth/public.decorator.js";
import { HealthService } from "./health.service.js";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Service health probe" })
  @ApiResponse({ status: 200, description: "Service status." })
  status() {
    return this.healthService.status();
  }

  @Get("live")
  @ApiOperation({ summary: "Service liveness probe" })
  @ApiResponse({ status: 200, description: "Process is responsive." })
  live() {
    return this.healthService.liveness();
  }

  @Get("ready")
  @ApiOperation({ summary: "Service readiness probe" })
  @ApiResponse({ status: 200, description: "Database is reachable." })
  @ApiResponse({ status: 503, description: "Database is unreachable." })
  ready() {
    return this.healthService.ready();
  }
}
