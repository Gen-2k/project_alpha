import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { CreateOrganizationDto as ICreateOrganizationDto } from "@repo/validation/organizations";

export class CreateOrganizationDto implements ICreateOrganizationDto {
  @ApiProperty({
    example: "Acme Corporation",
    description: "Human-readable name of the organization",
    maxLength: 100,
  })
  name!: string;

  @ApiPropertyOptional({
    example: "acme-corp",
    description:
      "URL-safe unique identifier. If omitted, will be generated automatically from the name.",
    maxLength: 64,
  })
  slug?: string;
}
