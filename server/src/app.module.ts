import { Module } from '@nestjs/common'
import { CatalogController } from './catalog/catalog.controller.js'
import { CatalogService } from './catalog/catalog.service.js'
import { DatabaseService } from './database/database.service.js'
import { HealthController } from './health.controller.js'
import { PoemsController } from './poems/poems.controller.js'
import { PoemsService } from './poems/poems.service.js'

@Module({
  controllers: [PoemsController, CatalogController, HealthController],
  providers: [DatabaseService, CatalogService, PoemsService],
})
export class AppModule {}
