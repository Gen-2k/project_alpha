import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { RegisterDto as IRegisterDto } from "@repo/validation/auth";

export class RegisterDto implements IRegisterDto {
  @ApiProperty({
    example: "ada@example.com",
    description: "Unique email address (max 255 chars, auto-normalized to lowercase)",
    format: "email",
  })
  email!: string;

  @ApiProperty({
    example: "correct-horse-battery-staple",
    description: "Account password (8 to 72 characters)",
    minLength: 8,
    maxLength: 72,
  })
  password!: string;

  @ApiPropertyOptional({ example: "Ada Lovelace", description: "Display name (max 255 chars)" })
  name?: string;

  @ApiPropertyOptional({ example: "en-US", description: "BCP 47 locale tag (max 35 chars)" })
  locale?: string;

  @ApiPropertyOptional({ example: "UTC", description: "IANA timezone (max 64 chars)" })
  timezone?: string;

  @ApiPropertyOptional({ example: "US", description: "ISO 3166-1 alpha-2 country code" })
  countryCode?: string;
}
