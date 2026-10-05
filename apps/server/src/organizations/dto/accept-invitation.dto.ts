import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { AcceptInvitationDto } from "@repo/validation/organizations";

export class AcceptInvitationDtoClass implements AcceptInvitationDto {
  @ApiProperty({
    example: "3f8b9e2a1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f",
    description: "High-entropy raw invitation token received via email",
  })
  token!: string;

  @ApiPropertyOptional({
    example: "Bob Builder",
    description: "Full name for new account registration (required if user does not already exist)",
  })
  name?: string;

  @ApiPropertyOptional({
    example: "correct-horse-battery-staple",
    description:
      "Password (8 to 72 characters) for new account registration or credential confirmation for existing accounts",
    minLength: 8,
    maxLength: 72,
  })
  password?: string;
}
