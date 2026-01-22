import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Generate or use existing request ID
    const requestId =
      (request.headers['x-request-id'] as string) ?? randomUUID();

    // Set request ID on request object
    request.headers['x-request-id'] = requestId;

    // Set request ID on response headers
    response.setHeader('X-Request-ID', requestId);

    return next.handle();
  }
}
