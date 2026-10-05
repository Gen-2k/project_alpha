import { ApiPropertyOptional } from "@nestjs/swagger";
import type { UpdateProjectDto as IUpdateProjectDto } from "@repo/validation/projects";

export class UpdateProjectDto implements IUpdateProjectDto {
  @ApiPropertyOptional({
    example: "Mobile App v2",
    description: "Updated display name of the project",
    maxLength: 100,
  })
  name?: string;

  @ApiPropertyOptional({
    example: "mobile-app-v2",
    description: "Updated URL-safe slug unique within the organization",
    maxLength: 64,
  })
  slug?: string;

  @ApiPropertyOptional({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9030",
    description: "Updated product group UUID, or null to unlink the project from its product",
    nullable: true,
  })
  productId?: string | null;

  @ApiPropertyOptional({
    example: "Consumer Apps",
    description: "Updated product group name to link or create inline",
    maxLength: 100,
  })
  productName?: string;

  @ApiPropertyOptional({
    example: "Updated project description",
    description: "Updated description",
    maxLength: 500,
  })
  description?: string | null;

  @ApiPropertyOptional({
    example: "en-US",
    description: "Updated source language BCP 47 code",
  })
  sourceLanguage?: string;

  @ApiPropertyOptional({
    example: ["es-ES", "ja-JP", "fr-FR"],
    type: [String],
    description: "Updated target languages list",
  })
  targetLanguages?: string[];
}
