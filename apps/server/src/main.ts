import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";

import { AppModule } from "./app.module.js";
import { parseCorsOrigins } from "./config/env.validation.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>("NODE_ENV") ?? "development";
  const isProduction = nodeEnv === "production";
  const port = config.get<number>("PORT") ?? 3001;
  const corsOrigin = config.get<string>("CORS_ORIGIN") ?? "http://localhost:3000";
  const origins = parseCorsOrigins(corsOrigin);

  // Behind LB/proxy req.ip + secure cookies + X-Forwarded-Proto are wrong
  // without this; throttler and `secure` cookies depend on it.
  const httpServer = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: unknown) => void;
  };
  httpServer.set("trust proxy", 1);

  // CSP disabled only for Swagger UI inline scripts in non-prod. Prod keeps
  // the default helmet CSP for XSS mitigation.
  app.use(helmet(isProduction ? {} : { contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.enableCors({
    origin: origins,
    credentials: true,
  });
  app.setGlobalPrefix("api/v1", {
    exclude: ["health", "health/{*path}"],
  });

  // Swagger exposes the full schema: never public in production.
  if (!isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Project Alpha API")
        .setDescription(
          "Backend service providing authentication with JWT/rotating refresh tokens, hybrid cookie transport, user identity, and service health monitoring probes.",
        )
        .setVersion("0.1.0")
        .addBearerAuth(
          {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            name: "Authorization",
            description: "Enter your JWT access token (Bearer <token>)",
            in: "header",
          },
          "JWT-auth",
        )
        .addTag("auth", "Authentication, credentials, token rotation, and session management")
        .addTag("users", "User profile and identity operations")
        .addTag("health", "Liveness, readiness, and service monitoring probes")
        .build(),
    );
    SwaggerModule.setup("docs", app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  await app.listen(port);
}
try {
  await bootstrap();
} catch (err) {
  console.error(
    `Fatal bootstrap error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
  );
  process.exit(1);
}
