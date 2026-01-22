import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

// Core modules
import { DatabaseModule } from './core/database/database.module';
import { RedisModule } from './core/redis/redis.module';
import { QueueModule } from './core/queue/queue.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { StoresModule } from './modules/stores/stores.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CustomersModule } from './modules/customers/customers.module';
import { TeamModule } from './modules/team/team.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { BillingModule } from './modules/billing/billing.module';
import { SettingsModule } from './modules/settings/settings.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { HealthModule } from './modules/health/health.module';

// Middleware
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

// Configuration
import { configuration, validationSchema } from './config/configuration';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'short',
          ttl: 1000, // 1 second
          limit: 10, // 10 requests per second
        },
        {
          name: 'medium',
          ttl: 60000, // 1 minute
          limit: config.get<number>('rateLimit.global') ?? 100,
        },
        {
          name: 'long',
          ttl: 3600000, // 1 hour
          limit: 1000,
        },
      ],
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Core modules
    DatabaseModule,
    RedisModule,
    QueueModule,

    // Feature modules
    AuthModule,
    UsersModule,
    TenantsModule,
    StoresModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    CustomersModule,
    TeamModule,
    AnalyticsModule,
    IntegrationsModule,
    BillingModule,
    SettingsModule,
    WebhooksModule,
    UploadsModule,
    HealthModule,
  ],
  providers: [
    // Global rate limit guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
