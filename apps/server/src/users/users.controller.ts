import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Req,
  Res,
  UnauthorizedException,
  UsePipes,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { SafeUser } from "@repo/validation/auth";
import { deleteAccountSchema } from "@repo/validation/auth";
import bcrypt from "bcryptjs";
import type { Response } from "express";

import { clearRefreshTokenCookie } from "../auth/auth.controller.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { UserResponseDto } from "../auth/dto/auth-response.dto.js";
import { ApiErrorResponseDto } from "../common/dto/error-response.dto.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { MailService } from "../mail/mail.service.js";
import { DeleteAccountDto, DeleteAccountResponseDto } from "./dto/delete-account.dto.js";
import { UsersService } from "./users.service.js";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
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

    await this.mailService.sendAccountDeletedNotification(user.email);
    await this.usersService.delete(user.id);

    clearRefreshTokenCookie(res);

    return {
      deleted: true,
      message: "Your account and all associated data have been permanently deleted.",
    };
  }
}
