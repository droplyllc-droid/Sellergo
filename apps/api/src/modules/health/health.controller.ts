/**
 * Health Controller - Basic health check without @nestjs/terminus
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DatabaseService } from '../../core/database/database.service';
import { RedisService } from '../../core/redis/redis.service';
import { Public } from '../auth/decorators/public.decorator';
import { SkipStoreCheck } from '../auth/decorators/skip-store-check.decorator';
import { SkipTenantCheck } from '../auth/decorators/skip-tenant-check.decorator';

interface HealthCheckResult {
  status: 'ok' | 'error';
  info?: Record<string, { status: string }>;
  error?: Record<string, { status: string; message?: string }>;
  details?: Record<string, { status: string; message?: string }>;
}

@ApiTags('Health')
@Controller('health')
@Public()
@SkipStoreCheck()
@SkipTenantCheck()
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async check(): Promise<HealthCheckResult> {
    const checks: Record<string, { status: string; message?: string }> = {};
    let hasError = false;

    // Check database
    try {
      const dbOk = await this.db.healthCheck();
      checks['database'] = { status: dbOk ? 'up' : 'down' };
      if (!dbOk) hasError = true;
    } catch (error) {
      checks['database'] = { status: 'down', message: error instanceof Error ? error.message : 'Unknown error' };
      hasError = true;
    }

    // Check Redis
    try {
      const redisOk = await this.redis.healthCheck();
      checks['redis'] = { status: redisOk ? 'up' : 'down' };
      if (!redisOk) hasError = true;
    } catch (error) {
      checks['redis'] = { status: 'down', message: error instanceof Error ? error.message : 'Unknown error' };
      hasError = true;
    }

    return {
      status: hasError ? 'error' : 'ok',
      details: checks,
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async liveness(): Promise<{ status: string }> {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  async readiness(): Promise<HealthCheckResult> {
    return this.check();
  }
}
