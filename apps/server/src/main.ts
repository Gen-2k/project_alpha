import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
      .setTitle("Server")
      .setDescription("Project Alpha API")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("docs", app, document);

  await app.listen(port);
}
await bootstrap();
