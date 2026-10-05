import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  OrganizationDto,
  OrganizationMemberDto,
  OrganizationRole,
  UserOrganizationMembershipDto,
} from "@repo/validation/organizations";

export class OrganizationResponseDto implements OrganizationDto {
  @ApiProperty({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9012",
    description: "UUIDv7 organization identifier",
  })
  id!: string;

  @ApiProperty({
    example: "Acme Corporation",
    description: "Name of the organization",
  })
  name!: string;

  @ApiProperty({
    example: "acme-corp",
    description: "URL-safe unique slug",
  })
  slug!: string;

  @ApiProperty({
    example: "free",
    description: "Current subscription plan tier",
  })
  planTier!: string;

  @ApiProperty({
    example: "2026-10-04T00:00:00.000Z",
    description: "Creation timestamp in UTC",
  })
  createdAt!: Date;

  @ApiProperty({
    example: "2026-10-04T00:00:00.000Z",
    description: "Last update timestamp in UTC",
  })
  updatedAt!: Date;
}

export class OrganizationMemberUserDto {
  @ApiProperty({ example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9013" })
  id!: string;

  @ApiProperty({ example: "colleague@example.com", format: "email" })
  email!: string;

  @ApiPropertyOptional({ example: "Ada Lovelace", nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ example: "https://example.com/avatar.png", nullable: true })
  avatarUrl!: string | null;
}

export class OrganizationMemberResponseDto implements OrganizationMemberDto {
  @ApiProperty({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9014",
    description: "UUIDv7 membership record identifier",
  })
  id!: string;

  @ApiProperty({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9012",
    description: "Organization identifier",
  })
  organizationId!: string;

  @ApiProperty({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9013",
    description: "User identifier",
  })
  userId!: string;

  @ApiProperty({
    example: "developer",
    enum: ["owner", "admin", "project_manager", "developer", "reviewer", "translator", "viewer"],
    description: "Role assigned within the organization",
  })
  role!: OrganizationRole;

  @ApiPropertyOptional({
    type: OrganizationMemberUserDto,
    description: "Safe user profile details",
  })
  user?: OrganizationMemberUserDto;

  @ApiProperty({
    example: "2026-10-04T00:00:00.000Z",
    description: "Timestamp when membership was created",
  })
  createdAt!: Date;

  @ApiProperty({
    example: "2026-10-04T00:00:00.000Z",
    description: "Timestamp when membership was last updated",
  })
  updatedAt!: Date;
}

export class UserOrganizationMembershipResponseDto implements UserOrganizationMembershipDto {
  @ApiProperty({
    type: OrganizationResponseDto,
    description: "Organization details",
  })
  organization!: OrganizationResponseDto;

  @ApiProperty({
    example: "owner",
    enum: ["owner", "admin", "project_manager", "developer", "reviewer", "translator", "viewer"],
    description: "User's role in this organization",
  })
  role!: OrganizationRole;
}
