import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  InvitationDetailsDto,
  OrganizationInvitationDto,
  OrganizationRole,
} from "@repo/validation/organizations";

export class OrganizationInvitationResponseDto implements OrganizationInvitationDto {
  @ApiProperty({ example: "01924b21-7b3b-7a1b-9c2d-3e4f5a6b7c8d" })
  id!: string;

  @ApiProperty({ example: "01924b21-7b3b-7a1b-9c2d-3e4f5a6b7c8e" })
  organizationId!: string;

  @ApiProperty({ example: "colleague@example.com" })
  email!: string;

  @ApiProperty({
    enum: ["owner", "admin", "project_manager", "developer", "reviewer", "translator", "viewer"],
    example: "developer",
  })
  role!: OrganizationRole;

  @ApiProperty({ example: "01924b21-7b3b-7a1b-9c2d-3e4f5a6b7c8f" })
  invitedByUserId!: string;

  @ApiProperty({ example: "2026-10-12T00:00:00.000Z" })
  expiresAt!: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  acceptedAt!: Date | null;

  @ApiProperty({ example: "2026-10-05T00:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "2026-10-05T00:00:00.000Z" })
  updatedAt!: Date;
}

export class InvitationDetailsResponseDto implements InvitationDetailsDto {
  @ApiProperty({ example: "01924b21-7b3b-7a1b-9c2d-3e4f5a6b7c8e" })
  organizationId!: string;

  @ApiProperty({ example: "Acme Corp" })
  organizationName!: string;

  @ApiProperty({ example: "colleague@example.com" })
  email!: string;

  @ApiProperty({
    enum: ["owner", "admin", "project_manager", "developer", "reviewer", "translator", "viewer"],
    example: "developer",
  })
  role!: OrganizationRole;

  @ApiPropertyOptional({ example: "Ada Lovelace", nullable: true })
  inviterName!: string | null;

  @ApiProperty({ example: "ada@example.com" })
  inviterEmail!: string;

  @ApiProperty({ example: "2026-10-12T00:00:00.000Z" })
  expiresAt!: Date;
}

export class AcceptInvitationResponseDto {
  @ApiProperty({ example: "Invitation accepted successfully" })
  message!: string;

  @ApiProperty({ example: "01924b21-7b3b-7a1b-9c2d-3e4f5a6b7c8e" })
  organizationId!: string;

  @ApiPropertyOptional({ example: "eyJhbGciOiJIUzI1Ni..." })
  accessToken?: string;
}
