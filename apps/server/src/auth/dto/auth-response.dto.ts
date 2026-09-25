import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { AuthTokensDto, SafeUser, SessionDto } from "@repo/validation/auth";

export class UserResponseDto implements SafeUser {
  @ApiProperty({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9012",
    description: "UUIDv7 primary identifier",
  })
  id!: string;

  @ApiProperty({
    example: "ada@example.com",
    description: "Normalized lowercase user email",
    format: "email",
  })
  email!: string;

  @ApiProperty({
    example: "2026-09-25T12:00:00.000Z",
    description: "Creation timestamp in UTC",
  })
  createdAt!: Date;

  @ApiProperty({
    example: "2026-09-25T12:00:00.000Z",
    description: "Last update timestamp in UTC",
  })
  updatedAt!: Date;
}

export class AuthTokensResponseDto implements AuthTokensDto {
  @ApiProperty({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "JWT access token (15-minute validity)",
  })
  accessToken!: string;

  @ApiProperty({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "JWT refresh token (7-day validity, also set in HttpOnly cookie for web)",
  })
  refreshToken!: string;

  @ApiProperty({
    type: UserResponseDto,
    description: "Authenticated user safe profile",
  })
  user!: UserResponseDto;
}

export class SessionResponseDto implements SessionDto {
  @ApiProperty({
    example: "018f3a2b-7c1e-7f30-8a4b-5c6d7e8f9013",
    description: "Session UUID",
  })
  id!: string;

  @ApiPropertyOptional({
    example: "127.0.0.1",
    description: "Client IP address from connection or proxy headers",
    nullable: true,
  })
  ipAddress!: string | null;

  @ApiPropertyOptional({
    example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    description: "Client User-Agent browser/device header",
    nullable: true,
  })
  userAgent!: string | null;

  @ApiProperty({
    example: "2026-09-25T12:00:00.000Z",
    description: "Session creation timestamp",
  })
  createdAt!: Date;

  @ApiProperty({
    example: "2026-10-02T12:00:00.000Z",
    description: "Session expiration timestamp",
  })
  expiresAt!: Date;
}

export class LogoutResponseDto {
  @ApiProperty({
    example: true,
    description: "Indicates successful session invalidation",
  })
  loggedOut!: true;
}

export class RevokeSessionResponseDto {
  @ApiProperty({
    example: true,
    description: "Indicates successful revocation of the requested session",
  })
  revoked!: true;
}
