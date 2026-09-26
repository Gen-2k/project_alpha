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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { loginSchema, registerSchema } from "@repo/validation/auth";
import type { Request, Response } from "express";

import { ApiErrorResponseDto } from "../common/dto/error-response.dto.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import { extractRequestMetadata } from "./auth.types.js";
import {
  AuthTokensResponseDto,
  LogoutResponseDto,
  RevokeSessionResponseDto,
  SessionResponseDto,
  UserResponseDto,
} from "./dto/auth-response.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshDto } from "./dto/refresh.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
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
  @ApiOperation({
    summary: "Register a new user",
    description:
      "Creates user credentials, sets an HttpOnly refresh cookie, and returns access and refresh tokens.",
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    type: AuthTokensResponseDto,
    description: "User registered; tokens issued.",
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: "Body failed validation." })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Email already registered." })
  @ApiResponse({
    status: 429,
    type: ApiErrorResponseDto,
    description: "Too many requests; rate limit exceeded.",
  })
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
  @ApiOperation({
    summary: "Log in with email and password",
    description:
      "Verifies user credentials, sets an HttpOnly refresh cookie, and returns access and refresh tokens.",
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto, description: "Tokens issued." })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Invalid credentials." })
  @ApiResponse({
    status: 429,
    type: ApiErrorResponseDto,
    description: "Too many requests; rate limit exceeded.",
  })
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
  @ApiOperation({
    summary: "Rotate a refresh token into a fresh pair",
    description:
      "Rotates a refresh token supplied via HttpOnly cookie or request body into a new token pair.",
  })
  @ApiBody({ type: RefreshDto, required: false })
  @ApiResponse({
    status: 200,
    type: AuthTokensResponseDto,
    description: "Fresh token pair issued.",
  })
  @ApiResponse({
    status: 401,
    type: ApiErrorResponseDto,
    description: "Invalid, expired, or reused token.",
  })
  @ApiResponse({
    status: 429,
    type: ApiErrorResponseDto,
    description: "Too many requests; rate limit exceeded.",
  })
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
  @ApiOperation({
    summary: "Invalidate a refresh token",
    description:
      "Clears the HttpOnly refresh cookie and deletes the token from database if present (always succeeds).",
  })
  @ApiBody({ type: RefreshDto, required: false })
  @ApiResponse({ status: 200, type: LogoutResponseDto, description: "Logged out successfully." })
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
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Revoke all active sessions for current user",
    description: "Revokes all refresh tokens belonging to the authenticated user.",
  })
  @ApiResponse({ status: 200, type: LogoutResponseDto, description: "All sessions revoked." })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Missing or invalid token." })
  async logoutAll(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    this.clearRefreshTokenCookie(res);
    return this.authService.logoutAll(req.user.sub);
  }

  @Get("sessions")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "List active sessions for current user",
    description:
      "Returns an array of non-revoked, unexpired sessions with IP and User-Agent details.",
  })
  @ApiResponse({ status: 200, type: [SessionResponseDto], description: "List of active sessions." })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Missing or invalid token." })
  sessions(@Req() req: AuthenticatedRequest) {
    return this.authService.listSessions(req.user.sub);
  }

  @Delete("sessions/:id")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Revoke a specific active session" })
  @ApiParam({ name: "id", description: "Session UUID" })
  @ApiResponse({ status: 200, type: RevokeSessionResponseDto, description: "Session revoked." })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Missing or invalid token." })
  revokeSession(@Param("id") sessionId: string, @Req() req: AuthenticatedRequest) {
    return this.authService.revokeSession(req.user.sub, sessionId);
  }

  @Get("me")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Current user from the bearer token" })
  @ApiResponse({ status: 200, type: UserResponseDto, description: "Authenticated user." })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Missing or invalid token." })
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
    if (body && typeof body === "object" && "refreshToken" in body) {
      const bodyToken = (body as Record<string, unknown>).refreshToken;
      if (typeof bodyToken === "string" && bodyToken.length > 0) {
        return bodyToken;
      }
    }
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME];
    if (typeof cookieToken === "string" && cookieToken.length > 0) {
      return cookieToken;
    }
    return undefined;
  }
}
