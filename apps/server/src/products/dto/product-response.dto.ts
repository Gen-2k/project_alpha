import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { ProductDto } from "@repo/validation/products";

export class ProductResponseDto implements ProductDto {
  @ApiProperty({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9030",
    description: "RFC 9562 UUIDv7 product identifier",
  })
  id!: string;

  @ApiProperty({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9012",
    description: "UUIDv7 of the parent organization",
  })
  organizationId!: string;

  @ApiProperty({
    example: "Ride Sharing",
    description: "Display name of the product group",
  })
  name!: string;

  @ApiProperty({
    example: "ride-sharing",
    description: "URL-safe unique slug within the organization",
  })
  slug!: string;

  @ApiPropertyOptional({
    example: "Consumer mobile and web ride booking apps",
    description: "Product description, or null if unassigned",
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    example: "2026-10-04T00:00:00.000Z",
    description: "Timestamp when product was created",
  })
  createdAt!: Date;

  @ApiProperty({
    example: "2026-10-04T00:00:00.000Z",
    description: "Timestamp when product was last updated",
  })
  updatedAt!: Date;
}
