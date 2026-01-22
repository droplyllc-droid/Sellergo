import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '@sellergo/types';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    validationErrors?: Array<{
      field: string;
      message: string;
      code: string;
    }>;
  };
  meta: {
    requestId: string;
    timestamp: string;
    path: string;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request.headers['x-request-id'] as string) ?? 'unknown';
    const timestamp = new Date().toISOString();
    const path = request.url;

    let status: number;
    let errorCode: string;
    let message: string;
    let details: Record<string, unknown> | undefined;
    let validationErrors:
      | Array<{ field: string; message: string; code: string }>
      | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        errorCode = this.getErrorCodeFromStatus(status);
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message =
          (responseObj['message'] as string) ??
          (Array.isArray(responseObj['message'])
            ? (responseObj['message'] as string[]).join(', ')
            : 'An error occurred');
        errorCode =
          (responseObj['code'] as string) ?? this.getErrorCodeFromStatus(status);
        details = responseObj['details'] as Record<string, unknown> | undefined;

        // Handle class-validator errors
        if (Array.isArray(responseObj['message'])) {
          validationErrors = (responseObj['message'] as string[]).map(
            (msg: string) => ({
              field: this.extractFieldFromMessage(msg),
              message: msg,
              code: 'VALIDATION_ERROR',
            })
          );
          message = 'Validation failed';
          errorCode = ErrorCode.VALIDATION_ERROR;
        }
      } else {
        message = 'An error occurred';
        errorCode = this.getErrorCodeFromStatus(status);
      }
    } else if (exception instanceof Error) {
      // Log unexpected errors but don't expose details
      this.logger.error(
        `Unexpected error: ${exception.message}`,
        exception.stack,
        {
          requestId,
          path,
        }
      );

      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      errorCode = ErrorCode.INTERNAL_ERROR;

      // In development, include the actual error message
      if (process.env['NODE_ENV'] === 'development') {
        details = {
          originalMessage: exception.message,
          stack: exception.stack,
        };
      }
    } else {
      this.logger.error('Unknown error type', { exception, requestId, path });

      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      errorCode = ErrorCode.INTERNAL_ERROR;
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        ...(details && { details }),
        ...(validationErrors && { validationErrors }),
      },
      meta: {
        requestId,
        timestamp,
        path,
      },
    };

    // Log error (excluding validation errors which are user errors)
    if (status >= 500) {
      this.logger.error(`[${requestId}] ${errorCode}: ${message}`, {
        status,
        path,
        details,
      });
    } else if (status >= 400 && !validationErrors) {
      this.logger.warn(`[${requestId}] ${errorCode}: ${message}`, {
        status,
        path,
      });
    }

    response.status(status).json(errorResponse);
  }

  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.RESOURCE_NOT_FOUND;
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMIT_EXCEEDED;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ErrorCode.SERVICE_UNAVAILABLE;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }

  private extractFieldFromMessage(message: string): string {
    // Try to extract field name from validation message
    const match = message.match(/^(\w+)\s/);
    return match?.[1] ?? 'unknown';
  }
}
