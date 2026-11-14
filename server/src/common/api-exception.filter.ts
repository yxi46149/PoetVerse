import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import type { Request, Response } from 'express'
import { Prisma } from '../generated/prisma/client.js'

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp()
    const request = context.getRequest<Request>()
    const response = context.getResponse<Response>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      response.status(status).json(
        typeof body === 'string' ? { statusCode: status, message: body } : body,
      )
      return
    }

    const databaseError =
      exception instanceof Prisma.PrismaClientKnownRequestError ||
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    const status = databaseError ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.INTERNAL_SERVER_ERROR
    const errorName = exception instanceof Error ? exception.name : 'UnknownError'
    const code = exception instanceof Prisma.PrismaClientKnownRequestError ? exception.code : undefined
    this.logger.error(`${request.method} ${request.path}: ${errorName}${code ? ` (${code})` : ''}`)
    response.status(status).json({
      statusCode: status,
      message: databaseError
        ? '数据库暂时不可用，请检查数据库连接、账号权限和表结构'
        : '服务暂时不可用，请稍后重试',
    })
  }
}
