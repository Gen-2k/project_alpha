import { Controller, Get, NotFoundException, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { SafeUser } from "@repo/validation/auth";

import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { UsersService } from "./users.service.js";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Retrieve profile of the current authenticated user" })
  @ApiResponse({ status: 200, description: "Authenticated user profile." })
  @ApiResponse({ status: 401, description: "Missing or invalid token." })
  @ApiResponse({ status: 404, description: "User not found." })
  async me(@Req() req: AuthenticatedRequest): Promise<SafeUser> {
    const user = await this.usersService.findById(req.user.sub);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }
}
