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
  Res,
  UnauthorizedException,
  UsePipes,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { LoginDto, RegisterDto } from "@repo/validation/auth";
import { loginSchema, registerSchema } from "@repo/validation/auth";
import type { Request, Response } from "express";

import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import { extractRequestMetadata } from "./auth.types.js";
import { Public } from "./public.decorator.js";

export const REFRESH_COOKIE_NAME = "refreshToken";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("register")
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({ status: 201, description: "User registered; tokens issued." })
  @ApiResponse({ status: 400, description: "Body failed validation." })
  @ApiResponse({ status: 409, description: "Email already registered." })
  @ApiResponse({ status: 429, description: "Too many requests; rate limit exceeded." })
  @UsePipes(new ZodValidationPipe(registerSchema))
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, extractRequestMetadata(req));
    this.setRefreshTokenCookie(res, result.refreshToken);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Log in with email and password" })
  @ApiResponse({ status: 200, description: "Tokens issued." })
  @ApiResponse({ status: 401, description: "Invalid credentials." })
  @ApiResponse({ status: 429, description: "Too many requests; rate limit exceeded." })
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, extractRequestMetadata(req));
    this.setRefreshTokenCookie(res, result.refreshToken);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate a refresh token into a fresh pair" })
  @ApiResponse({ status: 200, description: "Fresh token pair issued." })
  @ApiResponse({ status: 401, description: "Invalid, expired, or reused token." })
  @ApiResponse({ status: 429, description: "Too many requests; rate limit exceeded." })
  async refresh(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = this.extractRefreshToken(req, body);
    if (!token) {
      throw new UnauthorizedException("Refresh token is required via cookie or body");
    }

    const result = await this.authService.refresh(
      { refreshToken: token },
      extractRequestMetadata(req),
    );
    this.setRefreshTokenCookie(res, result.refreshToken);
    return result;
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Invalidate a refresh token (always succeeds)" })
  async logout(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearRefreshTokenCookie(res);
    const token = this.extractRefreshToken(req, body);
    if (token) {
      return this.authService.logout({ refreshToken: token });
    }
    return { loggedOut: true as const };
  }

  @Post("logout-all")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke all active sessions for current user" })
  @ApiResponse({ status: 200, description: "All sessions revoked." })
  @ApiResponse({ status: 401, description: "Missing or invalid token." })
  async logoutAll(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    this.clearRefreshTokenCookie(res);
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

  private setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: REFRESH_COOKIE_PATH,
      maxAge: this.authService.refreshExpiresInMs,
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: REFRESH_COOKIE_PATH,
    });
  }

  private extractRefreshToken(req: Request, body?: unknown): string | undefined {
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME];
    if (typeof cookieToken === "string" && cookieToken.length > 0) {
      return cookieToken;
    }
    if (body && typeof body === "object" && "refreshToken" in body) {
      const bodyToken = (body as Record<string, unknown>).refreshToken;
      if (typeof bodyToken === "string" && bodyToken.length > 0) {
        return bodyToken;
      }
    }
    return undefined;
  }
}
