import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import type { OnModuleDestroy } from '@nestjs/common'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../generated/prisma/client.js'

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly instance: PrismaClient | undefined
  private readonly configurationError: string | undefined

  constructor() {
    const connectionString = process.env.DATABASE_URL?.trim()
    if (!connectionString) {
      this.configurationError = '数据库尚未配置，请在 server/.env 中填写 DATABASE_URL 后重启后端'
    } else {
      try {
        const url = new URL(connectionString)
        const database = decodeURIComponent(url.pathname.slice(1))
        if (url.protocol !== 'mysql:' || !url.hostname || !database || !url.username) {
          throw new Error('Invalid database URL')
        }
        const tls = readBooleanOption(url, 'ssl')
        const allowPublicKeyRetrieval = readBooleanOption(url, 'allowPublicKeyRetrieval')
        const adapter = new PrismaMariaDb({
          host: url.hostname,
          port: Number(url.port || 3306),
          user: decodeURIComponent(url.username),
          password: decodeURIComponent(url.password),
          database,
          connectionLimit: 10,
          connectTimeout: 5000,
          acquireTimeout: 10000,
          allowPublicKeyRetrieval,
          ...(tls ? { ssl: { rejectUnauthorized: true } } : {}),
        }, { database })
        this.instance = new PrismaClient({ adapter })
      } catch {
        this.configurationError = 'DATABASE_URL 配置无效，请检查 server/.env 后重启后端'
      }
    }
    if (this.configurationError) {
      new Logger(DatabaseService.name).warn(this.configurationError)
    }
  }

  get client(): PrismaClient {
    if (!this.instance) {
      throw new ServiceUnavailableException('诗库服务暂时不可用，请稍后重试')
    }
    return this.instance
  }

  async onModuleDestroy() {
    await this.instance?.$disconnect()
  }
}

function readBooleanOption(url: URL, name: string) {
  const value = url.searchParams.get(name)
  if (value !== null && value !== 'true' && value !== 'false') {
    throw new Error(`Invalid ${name} option`)
  }
  return value === 'true'
}
