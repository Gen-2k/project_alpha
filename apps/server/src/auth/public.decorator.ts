import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

// Marks routes the global JwtAuthGuard must skip (login, register, …).
// Everything else is protected by default — openness is opt-in, never default.
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
