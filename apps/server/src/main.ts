import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";

import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const port = config.get<number>("PORT") ?? 3001;
  const corsOrigin = config.get<string>("CORS_ORIGIN") ?? "http://localhost:3000";
  const origins = corsOrigin.includes(",")
    ? corsOrigin.split(",").map((s) => s.trim())
    : corsOrigin;

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.enableCors({
    origin: origins,
    credentials: true,
  });
  app.setGlobalPrefix("api/v1", {
    exclude: ["health", "health/{*path}"],
  });

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

  await app.listen(port);
}
await bootstrap();
