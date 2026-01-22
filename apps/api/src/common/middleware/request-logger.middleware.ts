import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = request;
    const userAgent = request.get('user-agent') ?? 'unknown';
    const requestId = request.headers['x-request-id'] as string;
    const startTime = Date.now();

    // Log request
    this.logger.log(
      `[${requestId}] --> ${method} ${originalUrl} - ${ip} - ${userAgent}`
    );

    // Log response on finish
    response.on('finish', () => {
      const { statusCode } = response;
      const duration = Date.now() - startTime;
      const contentLength = response.get('content-length') ?? 0;

      const logMethod =
        statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'log';

      this.logger[logMethod](
        `[${requestId}] <-- ${method} ${originalUrl} ${statusCode} ${duration}ms ${contentLength}b`
      );
    });

    next();
  }
}
