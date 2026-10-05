import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { ProjectDto, ProjectProductSummaryDto } from "@repo/validation/projects";

export class ProjectProductSummaryResponseDto implements ProjectProductSummaryDto {
  @ApiProperty({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9030",
    description: "UUIDv7 of the product group",
  })
  id!: string;

  @ApiProperty({
    example: "Ride Sharing",
    description: "Display name of the product group",
  })
  name!: string;

  @ApiProperty({
    example: "ride-sharing",
    description: "URL-safe unique slug of the product group",
  })
  slug!: string;
}

export class ProjectResponseDto implements ProjectDto {
  @ApiProperty({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9030",
    description: "RFC 9562 UUIDv7 project identifier",
  })
  id!: string;

  @ApiProperty({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9012",
    description: "UUIDv7 of the parent organization",
  })
  organizationId!: string;

  @ApiPropertyOptional({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9030",
    description: "UUIDv7 of the linked product group, or null if unassigned",
    nullable: true,
  })
  productId!: string | null;

  @ApiPropertyOptional({
    type: ProjectProductSummaryResponseDto,
    description: "Summary of the linked product group, or null if unassigned",
    nullable: true,
  })
  product!: ProjectProductSummaryResponseDto | null;

  @ApiProperty({
    example: "Mobile App",
    description: "Display name of the project",
  })
  name!: string;

  @ApiProperty({
    example: "mobile-app",
    description: "URL-safe unique slug within the organization",
  })
  slug!: string;

  @ApiPropertyOptional({
    example: "iOS and Android localization targets",
    description: "Project description, or null if unassigned",
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    example: "en-US",
    description: "Source language code",
  })
  sourceLanguage!: string;

  @ApiProperty({
    example: ["es-ES", "ja-JP", "de-DE"],
    type: [String],
    description: "Array of configured target language codes",
  })
  targetLanguages!: string[];

  @ApiProperty({
    example: "2026-10-04T00:00:00.000Z",
    description: "Timestamp when project was created",
  })
  createdAt!: Date;

  @ApiProperty({
    example: "2026-10-04T00:00:00.000Z",
    description: "Timestamp when project was last updated",
  })
  updatedAt!: Date;
}
