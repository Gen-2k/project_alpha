import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>("PORT") ?? 3001;

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Server")
      .setDescription("Project Alpha API")
      .setVersion("0.0.0")
      .build(),
  );
  SwaggerModule.setup("docs", app, document);

  await app.listen(port);
}
await bootstrap();
