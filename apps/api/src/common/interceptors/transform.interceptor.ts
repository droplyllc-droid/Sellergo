import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    version: string;
  };
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) ?? 'unknown';

    return next.handle().pipe(
      map((data) => {
        // If response is already formatted (e.g., file download), return as-is
        if (data?.raw === true) {
          return data;
        }

        return {
          success: true as const,
          data,
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
            version: 'v1',
          },
        };
      })
    );
  }
}
