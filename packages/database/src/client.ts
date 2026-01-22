import { PrismaClient, Prisma } from '@prisma/client';

// Tenant context for RLS
export interface TenantContext {
  tenantId: string;
  userId?: string;
  storeId?: string;
}

// Global Prisma client instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create Prisma client with logging
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

// Singleton Prisma client
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Models that require tenant isolation
const TENANT_SCOPED_MODELS = [
  'Store',
  'StoreMember',
  'TeamInvitation',
  'StoreDomain',
  'NavigationMenu',
  'Product',
  'ProductImage',
  'ProductVariant',
  'Category',
  'ProductReview',
  'Order',
  'OrderItem',
  'OrderTimelineEvent',
  'AbandonedCart',
  'Customer',
  'CustomerBlock',
  'AdPixel',
  'AnalyticsIntegration',
  'Webhook',
  'WebhookDelivery',
  'InstalledApp',
  'CarrierConnection',
  'AnalyticsEvent',
  'ActivityLog',
] as const;

type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

// Check if a model requires tenant isolation
function isTenantScopedModel(model: string): model is TenantScopedModel {
  return TENANT_SCOPED_MODELS.includes(model as TenantScopedModel);
}

/**
 * Create a tenant-scoped Prisma client
 * This applies middleware to enforce tenant isolation on all queries
 */
export function createTenantClient(context: TenantContext): PrismaClient {
  const client = new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['error', 'warn'] : ['error'],
  });

  // Middleware to enforce tenant isolation
  client.$use(async (params, next) => {
    const { model, action, args } = params;

    // Skip if not a tenant-scoped model
    if (!model || !isTenantScopedModel(model)) {
      return next(params);
    }

    // Apply tenant filter for read operations
    if (['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(action)) {
      if (!args.where) {
        args.where = {};
      }
      args.where.tenantId = context.tenantId;
    }

    // Apply tenant ID for create operations
    if (['create', 'createMany'].includes(action)) {
      if (action === 'create') {
        args.data = {
          ...args.data,
          tenantId: context.tenantId,
        };
      } else if (action === 'createMany' && Array.isArray(args.data)) {
        args.data = args.data.map((item: Record<string, unknown>) => ({
          ...item,
          tenantId: context.tenantId,
        }));
      }
    }

    // Apply tenant filter for update operations
    if (['update', 'updateMany', 'upsert'].includes(action)) {
      if (!args.where) {
        args.where = {};
      }
      args.where.tenantId = context.tenantId;

      if (action === 'upsert' && args.create) {
        args.create = {
          ...args.create,
          tenantId: context.tenantId,
        };
      }
    }

    // Apply tenant filter for delete operations
    if (['delete', 'deleteMany'].includes(action)) {
      if (!args.where) {
        args.where = {};
      }
      args.where.tenantId = context.tenantId;
    }

    return next(params);
  });

  return client;
}

/**
 * Execute a callback within a transaction
 */
export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  }
): Promise<T> {
  return prisma.$transaction(fn, {
    maxWait: options?.maxWait ?? 5000,
    timeout: options?.timeout ?? 10000,
    isolationLevel: options?.isolationLevel ?? Prisma.TransactionIsolationLevel.ReadCommitted,
  });
}

/**
 * Execute a callback within a tenant-scoped transaction
 */
export async function withTenantTransaction<T>(
  context: TenantContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  }
): Promise<T> {
  const tenantClient = createTenantClient(context);

  try {
    return await tenantClient.$transaction(fn, {
      maxWait: options?.maxWait ?? 5000,
      timeout: options?.timeout ?? 10000,
      isolationLevel: options?.isolationLevel ?? Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  } finally {
    await tenantClient.$disconnect();
  }
}

// Re-export Prisma types
export { Prisma, PrismaClient };
export type {
  User,
  Session,
  Tenant,
  Store,
  StoreMember,
  Product,
  ProductImage,
  ProductVariant,
  Category,
  Order,
  OrderItem,
  Customer,
  CustomerBlock,
  BillingAccount,
  Transaction,
  Invoice,
  AdPixel,
  Webhook,
  InstalledApp,
  DeliveryCarrier,
  CarrierConnection,
  AnalyticsEvent,
  ActivityLog,
} from '@prisma/client';
