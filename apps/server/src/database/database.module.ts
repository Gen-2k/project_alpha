import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDb, DB } from "@repo/database/client";

// Global: infrastructure crosses every module, and importing this module
// in each feature module would be pure ceremony. The factory reads the
// validated DATABASE_URL (ConfigModule validates at boot, so it exists).
@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createDb(config.getOrThrow<string>("DATABASE_URL")),
    },
  ],
  exports: [DB],
})
export class DatabaseModule {}
