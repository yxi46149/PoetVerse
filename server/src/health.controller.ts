import { Controller, Get } from '@nestjs/common'
import { DatabaseService } from './database/database.service.js'

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async health() {
    await this.database.client.$queryRaw`SELECT 1`
    return { status: 'ok', database: 'connected' }
  }
}
