import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
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
import {
  acceptInvitationSchema,
  addMemberSchema,
  createInvitationSchema,
  createOrganizationSchema,
  updateMemberRoleSchema,
  updateOrganizationSchema,
} from "@repo/validation/organizations";
import type { Request } from "express";

import type { AuthenticatedRequest, JwtPayload } from "../auth/auth.types.js";
import { Public } from "../auth/public.decorator.js";
import { ApiErrorResponseDto } from "../common/dto/error-response.dto.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { AcceptInvitationDtoClass } from "./dto/accept-invitation.dto.js";
import { AddMemberDto } from "./dto/add-member.dto.js";
import { CreateInvitationDtoClass } from "./dto/create-invitation.dto.js";
import { CreateOrganizationDto } from "./dto/create-organization.dto.js";
import {
  AcceptInvitationResponseDto,
  InvitationDetailsResponseDto,
  OrganizationInvitationResponseDto,
} from "./dto/invitation-response.dto.js";
import {
  OrganizationMemberResponseDto,
  OrganizationResponseDto,
  UserOrganizationMembershipResponseDto,
} from "./dto/organization-response.dto.js";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto.js";
import { UpdateOrganizationDto } from "./dto/update-organization.dto.js";
import { OrgMembershipGuard } from "./guards/org-membership.guard.js";
import { RequireOrgRole } from "./guards/org-role.decorator.js";
import { OrganizationsService } from "./organizations.service.js";
import type { OrgAuthenticatedRequest } from "./organizations.types.js";

@ApiTags("organizations")
@ApiBearerAuth("JWT-auth")
@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: "Create a new organization",
    description:
      "Creates a new tenant workspace and automatically assigns the creator as the owner.",
  })
  @ApiBody({ type: CreateOrganizationDto })
  @ApiResponse({
    status: 201,
    type: OrganizationResponseDto,
    description: "Organization created successfully.",
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: "Validation error." })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Slug collision." })
  @UsePipes(new ZodValidationPipe(createOrganizationSchema))
  async create(
    @Body() dto: CreateOrganizationDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<OrganizationResponseDto> {
    return this.orgsService.create(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({
    summary: "List organizations for authenticated user",
    description: "Returns all organizations and workspaces the current user belongs to.",
  })
  @ApiResponse({
    status: 200,
    type: [UserOrganizationMembershipResponseDto],
    description: "List of user organizations with roles.",
  })
  async listUserOrganizations(
    @Req() req: AuthenticatedRequest,
  ): Promise<UserOrganizationMembershipResponseDto[]> {
    return this.orgsService.listForUser(req.user.sub);
  }

  @Get("invitations/:token")
  @Public()
  @ApiOperation({
    summary: "Get invitation details by token",
    description:
      "Public endpoint allowing an invitee to verify an invitation and view organization details before accepting.",
  })
  @ApiParam({ name: "token", description: "Raw invitation token string" })
  @ApiResponse({
    status: 200,
    type: InvitationDetailsResponseDto,
    description: "Valid invitation details.",
  })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "Invalid or expired token." })
  async getInvitationByToken(@Param("token") token: string): Promise<InvitationDetailsResponseDto> {
    return this.orgsService.getInvitationByToken(token);
  }

  @Post("invitations/accept")
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Accept an organization invitation",
    description:
      "Accepts an invitation using the token. For authenticated users, joins the organization directly. For new users, creates an account with password and joins.",
  })
  @ApiBody({ type: AcceptInvitationDtoClass })
  @ApiResponse({
    status: 200,
    type: AcceptInvitationResponseDto,
    description: "Invitation accepted successfully.",
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorResponseDto,
    description: "Invalid token or password required.",
  })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Incorrect password." })
  @ApiResponse({
    status: 403,
    type: ApiErrorResponseDto,
    description: "Authenticated user email mismatch.",
  })
  @UsePipes(new ZodValidationPipe(acceptInvitationSchema))
  async acceptInvitation(
    @Body() dto: AcceptInvitationDtoClass,
    @Req() req: Request & { user?: JwtPayload },
  ): Promise<AcceptInvitationResponseDto> {
    return this.orgsService.acceptInvitation(
      dto.token,
      { name: dto.name, password: dto.password },
      req.user?.sub,
    );
  }

  @Get(":id")
  @UseGuards(OrgMembershipGuard)
  @ApiOperation({
    summary: "Get organization details",
    description: "Returns metadata for a specific organization. Accessible only by members.",
  })
  @ApiParam({ name: "id", description: "Organization UUIDv7" })
  @ApiResponse({ status: 200, type: OrganizationResponseDto, description: "Organization details." })
  @ApiResponse({
    status: 403,
    type: ApiErrorResponseDto,
    description: "Not a member or not found (existence hidden).",
  })
  async getById(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req?: Request & { user?: JwtPayload },
  ): Promise<OrganizationResponseDto> {
    // Member-scoped read: returns undefined for non-members so existence
    // stays hidden even if the route guard is ever misconfigured.
    const org = await this.orgsService.findByIdForMember(id, req?.user?.sub ?? "");
    if (!org) {
      throw new ForbiddenException("You do not have access to this organization");
    }
    return org;
  }

  @Patch(":id")
  @UseGuards(OrgMembershipGuard)
  @RequireOrgRole("owner", "admin")
  @ApiOperation({
    summary: "Update organization",
    description: "Updates organization name or slug. Restricted to owners and admins.",
  })
  @ApiParam({ name: "id", description: "Organization UUIDv7" })
  @ApiBody({ type: UpdateOrganizationDto })
  @ApiResponse({
    status: 200,
    type: OrganizationResponseDto,
    description: "Organization updated successfully.",
  })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Insufficient permissions." })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Slug collision." })
  @UsePipes(new ZodValidationPipe(updateOrganizationSchema))
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    return this.orgsService.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgMembershipGuard)
  @RequireOrgRole("owner")
  @ApiOperation({
    summary: "Delete organization",
    description:
      "Permanently deletes an organization and cascades to members, invitations, products, and projects. Restricted strictly to the owner.",
  })
  @ApiParam({ name: "id", description: "Organization UUIDv7" })
  @ApiResponse({ status: 200, description: "Organization deleted successfully." })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Only owner can delete." })
  async delete(@Param("id", new ParseUUIDPipe()) id: string): Promise<{ message: string }> {
    await this.orgsService.delete(id);
    return { message: "Organization deleted successfully" };
  }

  @Get(":id/members")
  @UseGuards(OrgMembershipGuard)
  @ApiOperation({
    summary: "List organization members",
    description:
      "Returns all members and their assigned roles within the organization. Accessible to all members.",
  })
  @ApiParam({ name: "id", description: "Organization UUIDv7" })
  @ApiResponse({
    status: 200,
    type: [OrganizationMemberResponseDto],
    description: "List of members.",
  })
  async listMembers(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<OrganizationMemberResponseDto[]> {
    return this.orgsService.listMembers(id);
  }

  @Post(":id/members")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OrgMembershipGuard)
  @RequireOrgRole("owner", "admin", "project_manager")
  @ApiOperation({
    summary: "Add a member to the organization",
    description:
      "Adds an existing user to the organization by email address. Callers can only assign roles strictly below their own.",
  })
  @ApiParam({ name: "id", description: "Organization UUIDv7" })
  @ApiBody({ type: AddMemberDto })
  @ApiResponse({
    status: 201,
    type: OrganizationMemberResponseDto,
    description: "Member added successfully.",
  })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Insufficient permissions." })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "User not found." })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Already a member." })
  @UsePipes(new ZodValidationPipe(addMemberSchema))
  async addMember(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AddMemberDto,
    @Req() req: OrgAuthenticatedRequest,
  ): Promise<OrganizationMemberResponseDto> {
    return this.orgsService.addMember(id, dto, req.orgMembership?.role, req.user.sub);
  }

  @Patch(":id/members/:memberId")
  @UseGuards(OrgMembershipGuard)
  @RequireOrgRole("owner", "admin", "project_manager")
  @ApiOperation({
    summary: "Update member role",
    description:
      "Updates the role assigned to a member. Cannot demote the last owner or promote higher than caller's role. Restricted to owners, admins, and project managers.",
  })
  @ApiParam({ name: "id", description: "Organization UUIDv7" })
  @ApiParam({ name: "memberId", description: "Member record UUIDv7" })
  @ApiBody({ type: UpdateMemberRoleDto })
  @ApiResponse({
    status: 200,
    type: OrganizationMemberResponseDto,
    description: "Role updated successfully.",
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: "Cannot demote last owner." })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Insufficient permissions." })
  @UsePipes(new ZodValidationPipe(updateMemberRoleSchema))
  async updateMemberRole(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("memberId", new ParseUUIDPipe()) memberId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: OrgAuthenticatedRequest,
  ): Promise<OrganizationMemberResponseDto> {
    return this.orgsService.updateMemberRole(id, memberId, dto.role, req.orgMembership?.role);
  }

  @Delete(":id/members/:memberId")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgMembershipGuard)
  @ApiOperation({
    summary: "Remove member from organization",
    description:
      "Removes a member from the organization, or allows a member to leave. Cannot remove the last owner.",
  })
  @ApiParam({ name: "id", description: "Organization UUIDv7" })
  @ApiParam({ name: "memberId", description: "Member record UUIDv7" })
  @ApiResponse({ status: 200, description: "Member removed successfully." })
  @ApiResponse({
    status: 400,
    type: ApiErrorResponseDto,
    description: "Cannot remove last owner.",
  })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Insufficient permissions." })
  async removeMember(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("memberId", new ParseUUIDPipe()) memberId: string,
    @Req() req: OrgAuthenticatedRequest,
  ): Promise<{ message: string }> {
    const callerMembership = req.orgMembership;
    const isSelf = callerMembership?.id === memberId;
    const callerRole = callerMembership?.role;

    if (!isSelf && !callerRole) {
      throw new ForbiddenException("You do not have permission to remove this member");
    }

    await this.orgsService.removeMember(id, memberId, callerRole, isSelf);
    return { message: "Member removed successfully" };
  }

  @Post(":id/invitations")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(OrgMembershipGuard)
  @RequireOrgRole("owner", "admin", "project_manager")
  @ApiOperation({
    summary: "Invite a team member to the organization",
    description:
      "Generates a secure 7-day invitation token and dispatches an invitation email with an acceptance link.",
  })
  @ApiParam({ name: "id", description: "Organization UUIDv7" })
  @ApiBody({ type: CreateInvitationDtoClass })
  @ApiResponse({
    status: 201,
    type: OrganizationInvitationResponseDto,
    description: "Invitation sent successfully.",
  })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Insufficient permissions." })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "Organization not found." })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "User is already a member." })
  @UsePipes(new ZodValidationPipe(createInvitationSchema))
  async createInvitation(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: CreateInvitationDtoClass,
    @Req() req: OrgAuthenticatedRequest,
  ): Promise<OrganizationInvitationResponseDto> {
    return this.orgsService.createInvitation(
      id,
      req.user.sub,
      req.orgMembership?.role ?? "viewer",
      dto,
    );
  }

  @Get(":id/invitations")
  @UseGuards(OrgMembershipGuard)
  @RequireOrgRole("owner", "admin", "project_manager")
  @ApiOperation({
    summary: "List pending invitations for the organization",
    description: "Returns all active, unaccepted, unexpired invitations for the organization.",
  })
  @ApiParam({ name: "id", description: "Organization UUIDv7" })
  @ApiResponse({
    status: 200,
    type: [OrganizationInvitationResponseDto],
    description: "List of pending invitations.",
  })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Insufficient permissions." })
  async listInvitations(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<OrganizationInvitationResponseDto[]> {
    return this.orgsService.listInvitations(id);
  }

  @Delete(":id/invitations/:invitationId")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgMembershipGuard)
  @RequireOrgRole("owner", "admin", "project_manager")
  @ApiOperation({
    summary: "Revoke a pending invitation",
    description: "Permanently revokes an active invitation so its token can no longer be accepted.",
  })
  @ApiParam({ name: "id", description: "Organization UUIDv7" })
  @ApiParam({ name: "invitationId", description: "Invitation UUIDv7" })
  @ApiResponse({ status: 200, description: "Invitation revoked successfully." })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Insufficient permissions." })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "Invitation not found." })
  async revokeInvitation(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("invitationId", new ParseUUIDPipe()) invitationId: string,
  ): Promise<{ message: string }> {
    await this.orgsService.revokeInvitation(id, invitationId);
    return { message: "Invitation revoked successfully" };
  }
}
