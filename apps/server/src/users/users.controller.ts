import { Controller, Get, NotFoundException, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { SafeUser } from "@repo/validation/auth";

import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { UserResponseDto } from "../auth/dto/auth-response.dto.js";
import { ApiErrorResponseDto } from "../common/dto/error-response.dto.js";
import { UsersService } from "./users.service.js";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
      throw new NotFoundException("User not found");
    }
    return user;
  }
}
