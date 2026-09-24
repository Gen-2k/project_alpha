import { Body, Controller, Get, Post, UsePipes } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { EchoDto } from "@repo/validation/echo";
import { echoSchema } from "@repo/validation/echo";

import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { HealthService } from "./health.service.js";

// NOTE: Zod schemas don't generate Swagger body schemas automatically
// (unlike class-validator DTOs). Endpoints document status codes + summaries;
// add explicit @ApiBody schemas if rich body docs become necessary.
@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Service liveness probe" })
  @ApiResponse({ status: 200, description: "Service is running." })
  status(): object {
    return this.healthService.status();
  }

  @Post("echo")
  @ApiOperation({ summary: "Echo a message (validates the body with Zod)" })
  @ApiResponse({ status: 201, description: "Message echoed back." })
  @ApiResponse({ status: 400, description: "Body failed Zod validation." })
  @UsePipes(new ZodValidationPipe(echoSchema))
  echo(@Body() body: EchoDto): object {
    return this.healthService.echo(body.message);
  }
}
