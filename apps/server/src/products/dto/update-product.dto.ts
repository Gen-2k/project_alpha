import { ApiPropertyOptional } from "@nestjs/swagger";
import type { UpdateProductDto as IUpdateProductDto } from "@repo/validation/products";

export class UpdateProductDto implements IUpdateProductDto {
  @ApiPropertyOptional({
    example: "Ride Sharing v2",
    description: "Updated display name of the product group",
    maxLength: 100,
  })
  name?: string;

  @ApiPropertyOptional({
    example: "ride-sharing-v2",
    description: "Updated URL-safe unique slug within the organization",
    maxLength: 64,
  })
  slug?: string;

  @ApiPropertyOptional({
    example: "Updated product description",
    description: "Updated description",
    maxLength: 500,
  })
  description?: string | null;
}
