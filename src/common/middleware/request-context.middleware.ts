import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestContextMiddleware.name);

  use(
    request: Request & { requestId?: string },
    response: Response,
    next: NextFunction,
  ): void {
    const requestId = request.header('x-request-id') ?? randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    const startedAt = Date.now();
    response.on('finish', () => {
      const duration = Date.now() - startedAt;
      this.logger.log(
        `${request.method} ${request.originalUrl} ${response.statusCode} ${duration}ms ${requestId}`,
      );
    });

    next();
  }
}
