import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { createProductSchema, updateProductSchema } from "@repo/validation/products";

import { ApiErrorResponseDto } from "../common/dto/error-response.dto.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { OrgMembershipGuard } from "../organizations/guards/org-membership.guard.js";
import { RequireOrgRole } from "../organizations/guards/org-role.decorator.js";
import { CreateProductDto } from "./dto/create-product.dto.js";
import { ProductResponseDto } from "./dto/product-response.dto.js";
import { UpdateProductDto } from "./dto/update-product.dto.js";
import { ProductsService } from "./products.service.js";

@ApiTags("products")
@ApiBearerAuth("JWT-auth")
@UseGuards(OrgMembershipGuard)
@Controller("organizations/:organizationId/products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireOrgRole("owner", "admin", "project_manager")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: "Create product group in organization",
    description:
      "Creates a new product group within the specified organization. Restricted to owners, admins, and project managers.",
  })
  @ApiParam({ name: "organizationId", description: "Organization UUIDv7" })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({
    status: 201,
    type: ProductResponseDto,
    description: "Product created successfully.",
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: "Validation error." })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Insufficient permissions." })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Product slug collision." })
  @UsePipes(new ZodValidationPipe(createProductSchema))
  async create(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Body() dto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.create(organizationId, dto);
  }

  @Get()
  @ApiOperation({
    summary: "List product groups for organization",
    description:
      "Returns all product groups belonging to the organization. Powers the combobox selection in project forms. Accessible to all members.",
  })
  @ApiParam({ name: "organizationId", description: "Organization UUIDv7" })
  @ApiResponse({
    status: 200,
    type: [ProductResponseDto],
    description: "List of products.",
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorResponseDto,
    description: "Not an organization member.",
  })
  async list(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
  ): Promise<ProductResponseDto[]> {
    return this.productsService.listForOrganization(organizationId);
  }

  @Get(":productId")
  @ApiOperation({
    summary: "Get product details",
    description: "Returns metadata for a specific product group. Accessible to all members.",
  })
  @ApiParam({ name: "organizationId", description: "Organization UUIDv7" })
  @ApiParam({ name: "productId", description: "Product UUIDv7" })
  @ApiResponse({
    status: 200,
    type: ProductResponseDto,
    description: "Product details.",
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorResponseDto,
    description: "Not an organization member.",
  })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "Product not found." })
  async getById(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("productId", new ParseUUIDPipe()) productId: string,
  ): Promise<ProductResponseDto> {
    return this.productsService.findById(organizationId, productId);
  }

  @Patch(":productId")
  @RequireOrgRole("owner", "admin", "project_manager")
  @ApiOperation({
    summary: "Update product group",
    description:
      "Updates product name, slug, or description. Restricted to owners, admins, and project managers.",
  })
  @ApiParam({ name: "organizationId", description: "Organization UUIDv7" })
  @ApiParam({ name: "productId", description: "Product UUIDv7" })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({
    status: 200,
    type: ProductResponseDto,
    description: "Product updated successfully.",
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: "Validation error." })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Insufficient permissions." })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "Product not found." })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Slug collision." })
  @UsePipes(new ZodValidationPipe(updateProductSchema))
  async update(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(organizationId, productId, dto);
  }

  @Delete(":productId")
  @HttpCode(HttpStatus.OK)
  @RequireOrgRole("owner", "admin")
  @ApiOperation({
    summary: "Delete product group",
    description:
      "Permanently deletes a product group and safely unlinks all linked projects (sets product_id to NULL). Restricted to owners and admins.",
  })
  @ApiParam({ name: "organizationId", description: "Organization UUIDv7" })
  @ApiParam({ name: "productId", description: "Product UUIDv7" })
  @ApiResponse({ status: 200, description: "Product deleted successfully." })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Insufficient permissions." })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "Product not found." })
  async delete(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("productId", new ParseUUIDPipe()) productId: string,
  ): Promise<{ message: string }> {
    await this.productsService.delete(organizationId, productId);
    return { message: "Product deleted successfully" };
  }
}
