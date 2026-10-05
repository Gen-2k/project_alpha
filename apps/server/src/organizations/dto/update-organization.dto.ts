import { ApiPropertyOptional } from "@nestjs/swagger";
import type { UpdateOrganizationDto as IUpdateOrganizationDto } from "@repo/validation/organizations";

export class UpdateOrganizationDto implements IUpdateOrganizationDto {
  @ApiPropertyOptional({
    example: "Acme Global",
    description: "Updated human-readable name of the organization",
    maxLength: 100,
  })
  name?: string;

  @ApiPropertyOptional({
    example: "acme-global",
    description: "Updated URL-safe unique identifier",
    maxLength: 64,
  })
  slug?: string;
}
