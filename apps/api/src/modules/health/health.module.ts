/**
 * Health Module
 * Health check endpoints for monitoring
 */

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from '../../core/database/database.module';
import { RedisModule } from '../../core/redis/redis.module';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [HealthController],
})
export class HealthModule {}
