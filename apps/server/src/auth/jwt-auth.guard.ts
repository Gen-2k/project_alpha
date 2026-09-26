import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

import type { AuthenticatedRequest, JwtPayload } from "./auth.types.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = JwtAuthGuard.extractToken(request);
    if (!token) throw new UnauthorizedException("Missing bearer token");

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload & { type?: unknown }>(token);
      // Refresh tokens must never authenticate bearer endpoints (OWASP ASVS V3.5.3).
      if (payload.type === "refresh") {
        throw new UnauthorizedException("Invalid token type");
      }
      (request as unknown as AuthenticatedRequest).user = payload;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  private static extractToken(request: Request): string | undefined {
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    return scheme === "Bearer" ? token : undefined;
  }
}
