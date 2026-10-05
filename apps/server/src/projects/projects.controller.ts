import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
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
import { createProjectSchema, updateProjectSchema } from "@repo/validation/projects";

import { ApiErrorResponseDto } from "../common/dto/error-response.dto.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { OrgMembershipGuard } from "../organizations/guards/org-membership.guard.js";
import { RequireOrgRole } from "../organizations/guards/org-role.decorator.js";
import { CreateProjectDto } from "./dto/create-project.dto.js";
import { ListProjectsQueryDto } from "./dto/list-projects-query.dto.js";
import { ProjectResponseDto } from "./dto/project-response.dto.js";
import { UpdateProjectDto } from "./dto/update-project.dto.js";
import { ProjectsService } from "./projects.service.js";

@ApiTags("projects")
@ApiBearerAuth("JWT-auth")
@UseGuards(OrgMembershipGuard)
@Controller("organizations/:organizationId/projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireOrgRole("owner", "admin", "project_manager")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: "Create project in organization",
    description:
      "Creates a new localization project within the specified organization. Restricted to owners, admins, and project managers.",
  })
  @ApiParam({ name: "organizationId", description: "Organization UUIDv7" })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({
    status: 201,
    type: ProjectResponseDto,
    description: "Project created successfully.",
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: "Validation error." })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Insufficient permissions." })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Project slug collision." })
  @UsePipes(new ZodValidationPipe(createProjectSchema))
  async create(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.create(organizationId, dto);
  }

  @Get()
  @ApiOperation({
    summary: "List projects for organization",
    description:
      "Returns all localization projects belonging to the specified organization. Optionally filter by product group name. Accessible to all members.",
  })
  @ApiParam({ name: "organizationId", description: "Organization UUIDv7" })
  @ApiResponse({
    status: 200,
    type: [ProjectResponseDto],
    description: "List of projects.",
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorResponseDto,
    description: "Not an organization member.",
  })
  async list(
    @Param("organizationId") organizationId: string,
    @Query() query: ListProjectsQueryDto,
  ): Promise<ProjectResponseDto[]> {
    return this.projectsService.listForOrganization(organizationId, query);
  }

  @Get(":projectId")
  @ApiOperation({
    summary: "Get project details",
    description:
      "Returns metadata for a specific project within the organization. Accessible to all members.",
  })
  @ApiParam({ name: "organizationId", description: "Organization UUIDv7" })
  @ApiParam({ name: "projectId", description: "Project UUIDv7" })
  @ApiResponse({
    status: 200,
    type: ProjectResponseDto,
    description: "Project details.",
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorResponseDto,
    description: "Not an organization member.",
  })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "Project not found." })
  async getById(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.findById(organizationId, projectId);
  }

  @Patch(":projectId")
  @RequireOrgRole("owner", "admin", "project_manager")
  @ApiOperation({
    summary: "Update project",
    description:
      "Updates project name, slug, product group, description, or languages. Restricted to owners, admins, and project managers.",
  })
  @ApiParam({ name: "organizationId", description: "Organization UUIDv7" })
  @ApiParam({ name: "projectId", description: "Project UUIDv7" })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({
    status: 200,
    type: ProjectResponseDto,
    description: "Project updated successfully.",
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: "Validation error." })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Insufficient permissions." })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "Project not found." })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Slug collision." })
  @UsePipes(new ZodValidationPipe(updateProjectSchema))
  async update(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.update(organizationId, projectId, dto);
  }

  @Delete(":projectId")
  @HttpCode(HttpStatus.OK)
  @RequireOrgRole("owner", "admin")
  @ApiOperation({
    summary: "Delete project",
    description:
      "Permanently deletes a project. Restricted strictly to organization owners and admins.",
  })
  @ApiParam({ name: "organizationId", description: "Organization UUIDv7" })
  @ApiParam({ name: "projectId", description: "Project UUIDv7" })
  @ApiResponse({ status: 200, description: "Project deleted successfully." })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Insufficient permissions." })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "Project not found." })
  async delete(
    @Param("organizationId") organizationId: string,
    @Param("projectId") projectId: string,
  ): Promise<{ message: string }> {
    await this.projectsService.delete(organizationId, projectId);
    return { message: "Project deleted successfully" };
  }
}
