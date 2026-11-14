import 'reflect-metadata'
import 'dotenv/config'
import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'
import { AppModule } from './app.module.js'
import { ApiExceptionFilter } from './common/api-exception.filter.js'

async function bootstrap() {
  const port = Number(process.env.PORT || 8080)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  const app = await NestFactory.create(AppModule)
  app.use(helmet())
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  }))
  app.useGlobalFilters(new ApiExceptionFilter())
  app.enableShutdownHooks()

  const origins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean)
  if (origins?.length) {
    app.enableCors({ origin: origins, methods: ['GET', 'HEAD', 'OPTIONS'] })
  }

  const host = process.env.HOST || '127.0.0.1'
  await app.listen(port, host)
  Logger.log(`API listening on http://${host}:${port}/api`, 'Bootstrap')
}

bootstrap().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.message : 'API startup failed', undefined, 'Bootstrap')
  process.exitCode = 1
})
