import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UsePipes,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { LoginDto, RefreshDto, RegisterDto } from "@repo/validation/auth";
import { loginSchema, refreshSchema, registerSchema } from "@repo/validation/auth";
import type { Request } from "express";

import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import { extractRequestMetadata } from "./auth.types.js";
import { Public } from "./public.decorator.js";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({ status: 201, description: "User registered; tokens issued." })
  @ApiResponse({ status: 400, description: "Body failed validation." })
  @ApiResponse({ status: 409, description: "Email already registered." })
  @UsePipes(new ZodValidationPipe(registerSchema))
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, extractRequestMetadata(req));
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Log in with email and password" })
  @ApiResponse({ status: 200, description: "Tokens issued." })
  @ApiResponse({ status: 401, description: "Invalid credentials." })
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, extractRequestMetadata(req));
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate a refresh token into a fresh pair" })
  @ApiResponse({ status: 200, description: "Fresh token pair issued." })
  @ApiResponse({ status: 401, description: "Invalid, expired, or reused token." })
  @UsePipes(new ZodValidationPipe(refreshSchema))
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(dto, extractRequestMetadata(req));
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Invalidate a refresh token (always succeeds)" })
  @UsePipes(new ZodValidationPipe(refreshSchema))
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto);
  }

  @Post("logout-all")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke all active sessions for current user" })
  @ApiResponse({ status: 200, description: "All sessions revoked." })
  @ApiResponse({ status: 401, description: "Missing or invalid token." })
  logoutAll(@Req() req: AuthenticatedRequest) {
    return this.authService.logoutAll(req.user.sub);
  }

  @Get("sessions")
  @ApiBearerAuth()
  @ApiOperation({ summary: "List active sessions for current user" })
  @ApiResponse({ status: 200, description: "List of active sessions." })
  @ApiResponse({ status: 401, description: "Missing or invalid token." })
  sessions(@Req() req: AuthenticatedRequest) {
    return this.authService.listSessions(req.user.sub);
  }

  @Delete("sessions/:id")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke a specific active session" })
  @ApiParam({ name: "id", description: "Session UUID" })
  @ApiResponse({ status: 200, description: "Session revoked." })
  @ApiResponse({ status: 401, description: "Missing or invalid token." })
  revokeSession(@Param("id") sessionId: string, @Req() req: AuthenticatedRequest) {
    return this.authService.revokeSession(req.user.sub, sessionId);
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Current user from the bearer token" })
  @ApiResponse({ status: 200, description: "Authenticated user." })
  @ApiResponse({ status: 401, description: "Missing or invalid token." })
  me(@Req() req: AuthenticatedRequest) {
    return this.authService.me(req.user.sub);
  }
}
