import { ApiPropertyOptional } from "@nestjs/swagger";
import type { ListProjectsQueryDto as IListProjectsQueryDto } from "@repo/validation/projects";

export class ListProjectsQueryDto implements IListProjectsQueryDto {
  @ApiPropertyOptional({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9030",
    description: "Optional product group UUID to filter projects",
  })
  productId?: string;

  @ApiPropertyOptional({
    example: "Ride Sharing",
    description: "Optional product group name to filter projects within the organization",
    maxLength: 100,
  })
  productName?: string;
}
