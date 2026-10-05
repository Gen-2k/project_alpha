import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { CreateProductDto as ICreateProductDto } from "@repo/validation/products";

export class CreateProductDto implements ICreateProductDto {
  @ApiProperty({
    example: "Ride Sharing",
    description: "Display name of the product group",
    maxLength: 100,
  })
  name!: string;

  @ApiPropertyOptional({
    example: "ride-sharing",
    description: "URL-safe unique slug within the organization. Auto-generated if omitted.",
    maxLength: 64,
  })
  slug?: string;

  @ApiPropertyOptional({
    example: "Consumer mobile and web ride booking apps",
    description: "Optional description of the product group",
    maxLength: 500,
  })
  description?: string | null;
}
