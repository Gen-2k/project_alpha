import { ApiPropertyOptional } from "@nestjs/swagger";
import type { RefreshDto as IRefreshDto } from "@repo/validation/auth";

export class RefreshDto implements Partial<IRefreshDto> {
  @ApiPropertyOptional({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "JWT refresh token string (optional if provided via HttpOnly refreshToken cookie)",
  })
  refreshToken?: string;
}
