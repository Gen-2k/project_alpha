import { z } from "zod";

// Validated once at boot by ConfigModule (fail fast on bad env).
// PORT uses coerce: env vars arrive as strings, the app needs a number.

// Comma-separated http(s) origin list. Shared by the Zod refine below and
// main.ts so parsing never drifts between validation and consumption.
export function parseCorsOrigins(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isHttpUrl(entry: string): boolean {
  if (entry === "*") return false;
  try {
    const url = new URL(entry);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Case-insensitive string booleans ("TRUE", "yes", "1") for env flags.
function booleanEnv(defaultValue: boolean) {
  return z
    .union([
      z.boolean(),
      z
        .string()
        .transform((val) => ["true", "1", "yes"].includes(val.trim().toLowerCase()))
        .pipe(z.boolean()),
    ])
    .default(defaultValue);
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:3000")
    .refine(
      (val) => {
        const entries = parseCorsOrigins(val);
        return entries.length > 0 && entries.every(isHttpUrl);
      },
      { message: "CORS_ORIGIN must be a comma-separated list of http(s) URLs (no '*')" },
    ),
  DATABASE_URL: z
    .url()
    .refine((val) => val.startsWith("postgres://") || val.startsWith("postgresql://"), {
      message: "DATABASE_URL must be a postgres:// or postgresql:// URL",
    }),
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
  FRONTEND_URL: z.url().default("http://localhost:3000"),
  EMAIL_FROM: z.string().default("Project Alpha <no-reply@projectalpha.local>"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: booleanEnv(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  NORMALIZE_EMAIL: booleanEnv(false),
  // Baked in at image build (Docker ARG -> ENV); defaults to dev placeholder.
  // Surfaced by /health so deploys are traceable to a build.
  APP_VERSION: z.string().min(1).default("0.0.0"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment variables: ${result.error.message}`);
  }
  return result.data;
}
