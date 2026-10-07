import { Global, Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Db } from "@repo/database/client";
import { closeDb, createDb, DB } from "@repo/database/client";

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
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(DB) private readonly db: Db) {}

  async onModuleDestroy(): Promise<void> {
    await closeDb(this.db);
  }
}
