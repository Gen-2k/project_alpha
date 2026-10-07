import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Optional,
  Patch,
  Req,
  Res,
  UnauthorizedException,
  UsePipes,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { SafeUser } from "@repo/validation/auth";
import { deleteAccountSchema, updateProfileSchema } from "@repo/validation/auth";
import bcrypt from "bcryptjs";
import type { Response } from "express";

import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { clearRefreshTokenCookie, resolveCookieSecure } from "../auth/auth.types.js";
import { UserResponseDto } from "../auth/dto/auth-response.dto.js";
import { ApiErrorResponseDto } from "../common/dto/error-response.dto.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { MailService } from "../mail/mail.service.js";
import { DeleteAccountDto, DeleteAccountResponseDto } from "./dto/delete-account.dto.js";
import { UpdateProfileDto } from "./dto/update-profile.dto.js";
import { UsersService } from "./users.service.js";

@ApiTags("users")
@Controller("users")
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  @Get("me")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Retrieve profile of the current authenticated user",
    description:
      "Returns the safe user profile fields (excluding password hash) for the authenticated bearer token.",
  })
  @ApiResponse({ status: 200, type: UserResponseDto, description: "Authenticated user profile." })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Missing or invalid token." })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "User not found." })
  async me(@Req() req: AuthenticatedRequest): Promise<SafeUser> {
    const user = await this.usersService.findById(req.user.sub);
    if (!user) {
      throw new NotFoundException("User profile not found");
    }
    return user;
  }

  @Patch("me")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: "Update profile of the current authenticated user",
    description:
      "Updates user profile preferences (name, locale, timezone, countryCode, avatarUrl).",
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, type: UserResponseDto, description: "Profile updated successfully." })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: "Invalid profile data." })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Missing or invalid token." })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "User not found." })
  @UsePipes(new ZodValidationPipe(updateProfileSchema))
  async updateMe(
    @Body() dto: UpdateProfileDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SafeUser> {
    return this.usersService.updateProfile(req.user.sub, dto);
  }

  @Delete("me")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: "Permanently delete current user account",
    description:
      "Requires password confirmation. Permanently removes the user and cascades deletion to all sessions and tokens.",
  })
  @ApiBody({ type: DeleteAccountDto })
  @ApiResponse({
    status: 200,
    type: DeleteAccountResponseDto,
    description: "Account deleted successfully.",
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorResponseDto,
    description: "Cannot delete account while sole owner of an organization.",
  })
  @ApiResponse({
    status: 401,
    type: ApiErrorResponseDto,
    description: "Incorrect password or invalid token.",
  })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "User not found." })
  @UsePipes(new ZodValidationPipe(deleteAccountSchema))
  async deleteMe(
    @Body() dto: DeleteAccountDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DeleteAccountResponseDto> {
    const user = await this.usersService.findByIdWithHash(req.user.sub);
    if (!user) {
      throw new NotFoundException("User profile not found");
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException("The password provided is incorrect");
    }

    const soleOwnedOrgNames = await this.usersService.findSoleOwnedOrganizationNames(user.id);
    if (soleOwnedOrgNames.length > 0) {
      const namesList = soleOwnedOrgNames.map((n) => `"${n}"`).join(", ");
      throw new BadRequestException(
        `Cannot delete account while you are the sole owner of organization(s): ${namesList}. Please transfer ownership or delete the organization first.`,
      );
    }

    await this.usersService.delete(user.id);
    clearRefreshTokenCookie(res, resolveCookieSecure(this.config));

    try {
      await this.mailService.sendAccountDeletedNotification(user.email);
    } catch (err) {
      this.logger.warn(`Failed to dispatch account deleted notification: ${String(err)}`);
    }

    return {
      deleted: true,
      message: "Your account and all associated data have been permanently deleted.",
    };
  }
}
