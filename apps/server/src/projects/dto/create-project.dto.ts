import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { CreateProjectDto as ICreateProjectDto } from "@repo/validation/projects";

export class CreateProjectDto implements ICreateProjectDto {
  @ApiProperty({
    example: "Mobile App",
    description: "Display name of the localization project",
    maxLength: 100,
  })
  name!: string;

  @ApiPropertyOptional({
    example: "mobile-app",
    description: "URL-safe slug unique within the organization. Auto-generated if omitted.",
    maxLength: 64,
  })
  slug?: string;

  @ApiPropertyOptional({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9030",
    description: "Optional UUIDv7 of an existing product group to link to",
  })
  productId?: string;

  @ApiPropertyOptional({
    example: "Ride Sharing",
    description:
      "Optional product group name to link or create inline on the fly if productId is not specified",
    maxLength: 100,
  })
  productName?: string;

  @ApiPropertyOptional({
    example: "iOS and Android localization targets",
    description: "Optional description of the project",
    maxLength: 500,
  })
  description?: string | null;

  @ApiPropertyOptional({
    example: "en-US",
    default: "en-US",
    description: "Source language BCP 47 code for original copy",
  })
  sourceLanguage = "en-US";

  @ApiPropertyOptional({
    example: ["es-ES", "ja-JP", "de-DE"],
    default: [],
    type: [String],
    description: "Target languages to localize into",
  })
  targetLanguages: string[] = [];
}
