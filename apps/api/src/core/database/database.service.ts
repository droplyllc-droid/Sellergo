import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@sellergo/database';

export interface TenantContext {
  tenantId: string;
  userId?: string;
  storeId?: string;
}

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    super({
      log:
        process.env['NODE_ENV'] === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'error' },
              { emit: 'stdout', level: 'warn' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });
  }

  /**
   * Property alias for direct prisma access
   * Getter to allow `this.db.prisma.xxx` pattern
   * Returns the DatabaseService instance itself since it extends PrismaClient
   */
  get prisma(): this {
    return this;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');

    // Log slow queries in development
    if (process.env['NODE_ENV'] === 'development') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.$on('query', (e: any) => {
        if (e.duration > 100) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Get a tenant-scoped database client
   * Note: For proper RLS, use withTenantTransaction instead
   */
  async withTenant(_tenantId: string): Promise<this> {
    // TODO: Implement proper RLS with session variables
    // For now, return the client directly
    // The tenant isolation should be enforced at query level
    return this;
  }

  /**
   * Execute operations within a tenant context with RLS
   * This sets the PostgreSQL session variable for RLS
   */
  async withTenantTransaction<T>(
    context: TenantContext,
    callback: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.$transaction(async (tx: Prisma.TransactionClient) => {
      // Set tenant context for RLS
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${context.tenantId}, true)`;

      if (context.userId) {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${context.userId}, true)`;
      }

      if (context.storeId) {
        await tx.$executeRaw`SELECT set_config('app.store_id', ${context.storeId}, true)`;
      }

      return callback(tx);
    });
  }

  /**
   * Execute a transaction with custom options
   */
  async runTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
    }
  ): Promise<T> {
    return this.$transaction(callback, {
      maxWait: options?.maxWait ?? 5000,
      timeout: options?.timeout ?? 10000,
    });
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get database statistics (for monitoring)
   */
  async getStats(): Promise<{
    connectionCount: number;
    databaseSize: string;
  }> {
    const [connectionResult, sizeResult] = await Promise.all([
      this.$queryRaw<{ count: bigint }[]>`
        SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
      `,
      this.$queryRaw<{ size: string }[]>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `,
    ]);

    return {
      connectionCount: Number(connectionResult[0]?.count ?? 0),
      databaseSize: sizeResult[0]?.size ?? 'unknown',
    };
  }
}
