import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UsePipes,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
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
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  verifyEmailSchema,
} from "@repo/validation/auth";
import type { Request, Response } from "express";

import { ApiErrorResponseDto } from "../common/dto/error-response.dto.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import {
  clearRefreshTokenCookie,
  extractRequestMetadata,
  REFRESH_COOKIE_NAME,
  resolveCookieSecure,
  setRefreshTokenCookie,
} from "./auth.types.js";
import {
  AuthTokensResponseDto,
  LogoutResponseDto,
  MessageResponseDto,
  RegisterResponseDto,
  RevokeSessionResponseDto,
  SessionResponseDto,
} from "./dto/auth-response.dto.js";
import { ForgotPasswordDto } from "./dto/forgot-password.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshDto } from "./dto/refresh.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { ResendVerificationDto } from "./dto/resend-verification.dto.js";
import { ResetPasswordDto } from "./dto/reset-password.dto.js";
import { UpdatePasswordDto } from "./dto/update-password.dto.js";
import { VerifyEmailDto } from "./dto/verify-email.dto.js";
import { Public } from "./public.decorator.js";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  // ConfigService is global; optional here so existing single-arg unit tests
  // keep working. Cookie `secure` comes from validated config with raw-env
  // fallback (see resolveCookieSecure).
  constructor(
    private readonly authService: AuthService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  private get cookieSecure(): boolean {
    return resolveCookieSecure(this.config);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post("register")
  @ApiOperation({
    summary: "Register a new user",
    description: "Creates an unverified user account and dispatches an email verification link.",
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    type: RegisterResponseDto,
    description: "User registered; email verification link dispatched.",
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: "Body failed validation." })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Email already registered." })
  @ApiResponse({
    status: 429,
    type: ApiErrorResponseDto,
    description: "Too many requests; rate limit exceeded.",
  })
  @UsePipes(new ZodValidationPipe(registerSchema))
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
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
      "Rotates the refresh token supplied via HttpOnly cookie or JSON request body into a new token pair and sets a fresh cookie.",
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
    description: "Missing, expired, or invalid refresh token.",
  })
  @ApiResponse({
    status: 429,
    type: ApiErrorResponseDto,
    description: "Too many requests; rate limit exceeded.",
  })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.extractRefreshToken(req);
    if (!token) {
      throw new UnauthorizedException(
        "A refresh token must be provided via cookie or request body",
      );
    }

    const result = await this.authService.refresh(
      { refreshToken: token },
      extractRequestMetadata(req),
    );
    this.setRefreshTokenCookie(res, result.refreshToken);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Invalidate the current session",
    description:
      "Clears the HttpOnly refresh cookie and deletes the token from database if present via cookie or request body (always succeeds).",
  })
  @ApiBody({ type: RefreshDto, required: false })
  @ApiResponse({ status: 200, type: LogoutResponseDto, description: "Logged out successfully." })
  @ApiResponse({
    status: 429,
    type: ApiErrorResponseDto,
    description: "Too many requests; rate limit exceeded.",
  })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.extractRefreshToken(req);
    clearRefreshTokenCookie(res, this.cookieSecure);
    if (token) {
      return this.authService.logout({ refreshToken: token });
    }
    return { loggedOut: true as const };
  }

  @Post("logout-all")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Revoke all active sessions for current user",
    description: "Revokes all refresh tokens belonging to the authenticated user.",
  })
  @ApiResponse({ status: 200, type: LogoutResponseDto, description: "All sessions revoked." })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Missing or invalid token." })
  @ApiResponse({
    status: 429,
    type: ApiErrorResponseDto,
    description: "Too many requests; rate limit exceeded.",
  })
  async logoutAll(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    clearRefreshTokenCookie(res, this.cookieSecure);
    return this.authService.logoutAll(req.user.sub);
  }

  @Get("sessions")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "List active sessions for current user",
    description:
      "Returns an array of non-revoked, unexpired sessions with IP and User-Agent details.",
  })
  @ApiResponse({ status: 200, type: [SessionResponseDto], description: "List of active sessions." })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Missing or invalid token." })
  @ApiResponse({
    status: 429,
    type: ApiErrorResponseDto,
    description: "Too many requests; rate limit exceeded.",
  })
  sessions(@Req() req: AuthenticatedRequest) {
    return this.authService.listSessions(req.user.sub);
  }

  @Delete("sessions/:id")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Revoke a specific active session" })
  @ApiParam({ name: "id", description: "Session UUID" })
  @ApiResponse({ status: 200, type: RevokeSessionResponseDto, description: "Session revoked." })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: "Invalid session id." })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Missing or invalid token." })
  @ApiResponse({
    status: 429,
    type: ApiErrorResponseDto,
    description: "Too many requests; rate limit exceeded.",
  })
  revokeSession(
    @Param("id", new ParseUUIDPipe()) sessionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.revokeSession(req.user.sub, sessionId);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Verify account email address",
    description:
      "Validates email verification token, marks user email as verified, and directs user to login.",
  })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({
    status: 200,
    type: MessageResponseDto,
    description: "Email verified successfully.",
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorResponseDto,
    description: "Invalid or expired verification token.",
  })
  @ApiResponse({
    status: 429,
    type: ApiErrorResponseDto,
    description: "Too many requests; rate limit exceeded.",
  })
  @UsePipes(new ZodValidationPipe(verifyEmailSchema))
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Resend email verification link",
    description:
      "Dispatches a new email verification token if the account exists and is unverified. Always returns 200 to prevent user enumeration.",
  })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({
    status: 200,
    type: MessageResponseDto,
    description: "Verification link dispatched if account is unverified.",
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: "Body failed validation." })
  @ApiResponse({
    status: 429,
    type: ApiErrorResponseDto,
    description: "Too many requests; rate limit exceeded.",
  })
  @UsePipes(new ZodValidationPipe(resendVerificationSchema))
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Request password reset email",
    description:
      "Initiates password recovery. Always returns 200 with an identical message to prevent account enumeration.",
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    type: MessageResponseDto,
    description: "Password reset instructions dispatched if email exists.",
  })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: "Body failed validation." })
  @ApiResponse({
    status: 429,
    type: ApiErrorResponseDto,
    description: "Too many requests; rate limit exceeded.",
  })
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reset password using reset token",
    description:
      "Validates the reset token, updates account password, and revokes all active refresh tokens across devices.",
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    type: MessageResponseDto,
    description: "Password reset successful.",
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorResponseDto,
    description: "Invalid or expired token, or invalid password.",
  })
  @ApiResponse({
    status: 429,
    type: ApiErrorResponseDto,
    description: "Too many requests; rate limit exceeded.",
  })
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post("update-password")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: "Update account password for authenticated user",
    description:
      "Verifies current password, updates to new password, and revokes all other device sessions.",
  })
  @ApiBody({ type: UpdatePasswordDto })
  @ApiResponse({
    status: 200,
    type: MessageResponseDto,
    description: "Password updated successfully.",
  })
  @ApiResponse({
    status: 400,
    type: ApiErrorResponseDto,
    description: "New password cannot match current password, or failed validation.",
  })
  @ApiResponse({
    status: 401,
    type: ApiErrorResponseDto,
    description: "Current password incorrect or invalid bearer token.",
  })
  @ApiResponse({
    status: 429,
    type: ApiErrorResponseDto,
    description: "Too many requests; rate limit exceeded.",
  })
  @UsePipes(new ZodValidationPipe(updatePasswordSchema))
  updatePassword(@Body() dto: UpdatePasswordDto, @Req() req: AuthenticatedRequest) {
    const currentRefreshToken = this.extractRefreshToken(req);
    return this.authService.updatePassword(req.user.sub, dto, currentRefreshToken);
  }

  private setRefreshTokenCookie(res: Response, token: string): void {
    setRefreshTokenCookie(res, token, this.authService.refreshExpiresInMs, this.cookieSecure);
  }

  private extractRefreshToken(req: Request): string | undefined {
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME];
    if (typeof cookieToken === "string" && cookieToken.length > 0) {
      return cookieToken;
    }
    const bodyToken = (req.body as Record<string, unknown> | undefined)?.refreshToken;
    if (typeof bodyToken === "string" && bodyToken.length > 0) {
      return bodyToken;
    }
    return undefined;
  }
}
