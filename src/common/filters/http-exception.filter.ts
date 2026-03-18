import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const normalized = exceptionResponse as {
          message?: string | string[];
          code?: string;
          error?: string;
        };
        if (Array.isArray(normalized.message)) {
          message = normalized.message.join(', ');
        } else if (normalized.message) {
          message = normalized.message;
        }
        code = normalized.code ?? normalized.error ?? code;
      }
    }

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `Unhandled error for ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      error: {
        code,
        message,
        request_id: request.requestId,
      },
    });
  }
}
