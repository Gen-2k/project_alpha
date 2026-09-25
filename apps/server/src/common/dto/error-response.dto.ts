import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import type { ApiErrorIssue, ApiErrorResponse } from "../filters/all-exceptions.filter.js";

export class ApiErrorIssueDto implements ApiErrorIssue {
  @ApiProperty({ example: "email", description: "Path or property that caused the error" })
  path!: string;

  @ApiProperty({ example: "Invalid email address", description: "Explanation of the failure" })
  message!: string;
}

export class ApiErrorResponseDto implements ApiErrorResponse {
  @ApiProperty({ example: 400, description: "HTTP status code" })
  statusCode!: number;

  @ApiProperty({ example: "Bad Request", description: "HTTP status text" })
  error!: string;

  @ApiProperty({
    example: "VALIDATION_FAILED",
    description: "Machine-readable error classification code",
  })
  code!: string;

  @ApiProperty({ example: "Validation failed", description: "Human-readable summary of the error" })
  message!: string;

  @ApiPropertyOptional({
    type: [ApiErrorIssueDto],
    description: "List of specific field validation issues",
  })
  issues?: ApiErrorIssueDto[];

  @ApiProperty({
    example: "/api/v1/auth/register",
    description: "Request path that generated this error",
  })
  path!: string;

  @ApiPropertyOptional({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9014",
    description: "Unique request tracing correlation ID",
  })
  requestId?: string;

  @ApiProperty({
    example: "2026-09-25T12:00:00.000Z",
    description: "ISO timestamp of error occurrence",
  })
  timestamp!: string;
}
