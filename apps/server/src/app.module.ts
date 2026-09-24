import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { validateEnv } from "./config/env.validation.js";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [
    // Validated once at boot: invalid env fails fast instead of
    // running half-configured. See src/config/env.validation.ts.
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
