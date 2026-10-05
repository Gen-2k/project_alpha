import { ApiPropertyOptional } from "@nestjs/swagger";
import type { RefreshDto as IRefreshDto } from "@repo/validation/auth";

export class RefreshDto implements Partial<IRefreshDto> {
  @ApiPropertyOptional({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "Optional refresh token string if not supplied via HttpOnly cookie",
  })
  refreshToken?: string;
}
