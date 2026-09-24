import { z } from "zod";

// Validated once at boot by ConfigModule (fail fast on bad env).
// PORT uses coerce: env vars arrive as strings, the app needs a number.
const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment variables: ${result.error.message}`);
  }
  return result.data;
}
