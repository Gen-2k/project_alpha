import { ApiPropertyOptional } from "@nestjs/swagger";
import type { UpdateProfileDto as IUpdateProfileDto } from "@repo/validation/auth";

export class UpdateProfileDto implements IUpdateProfileDto {
  @ApiPropertyOptional({
    example: "Ada Lovelace",
    description: "User display name (null to clear)",
    maxLength: 255,
    nullable: true,
  })
  name?: string | null;

  @ApiPropertyOptional({
    example: "en-US",
    description: "Preferred BCP 47 language/locale tag",
    maxLength: 35,
  })
  locale?: string;

  @ApiPropertyOptional({
    example: "America/New_York",
    description: "Preferred IANA timezone identifier",
    maxLength: 64,
  })
  timezone?: string;

  @ApiPropertyOptional({
    example: "US",
    description: "2-letter ISO 3166-1 alpha-2 country code (null to clear)",
    maxLength: 2,
    nullable: true,
  })
  countryCode?: string | null;

  @ApiPropertyOptional({
    example: "https://example.com/avatar.png",
    description: "Public avatar image URL (null to clear)",
    maxLength: 2048,
    nullable: true,
  })
  avatarUrl?: string | null;
}
