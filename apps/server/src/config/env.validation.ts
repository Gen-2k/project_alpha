import { z } from "zod";

// Validated once at boot by ConfigModule (fail fast on bad env).
// PORT uses coerce: env vars arrive as strings, the app needs a number.
const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.url(),
  // HS256 needs a secret with real entropy: 32+ chars, never committed.
  // jsonwebtoken durations ("15m", "7d") for access/refresh lifetimes.
  JWT_SECRET: z.string().min(32),
  // Durations use jsonwebtoken's format ("15m", "7d"): validated by shape
  // here, converted to milliseconds where signing happens.
  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/)
    .default("15m"),
  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/)
    .default("7d"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment variables: ${result.error.message}`);
  }
  return result.data;
}
