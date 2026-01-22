import type { Prisma } from '@prisma/client';

// =============================================================================
// QUERY HELPERS
// =============================================================================

export interface PaginationInput {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginationOutput {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface SortInput {
  field: string;
  order: 'asc' | 'desc';
}

export interface QueryOptions {
  pagination?: PaginationInput;
  sort?: SortInput;
}

// =============================================================================
// STORE INCLUDE TYPES
// =============================================================================

export const storeWithOwner = {
  owner: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.StoreInclude;

export const storeWithMembers = {
  members: {
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          lastLoginAt: true,
        },
      },
    },
    where: {
      status: 'ACTIVE',
    },
  },
} satisfies Prisma.StoreInclude;

export const storeWithStatistics = {
  _count: {
    select: {
      products: true,
      orders: true,
      customers: true,
      members: true,
    },
  },
} satisfies Prisma.StoreInclude;

// =============================================================================
// PRODUCT INCLUDE TYPES
// =============================================================================

export const productWithImages = {
  images: {
    orderBy: {
      position: 'asc' as const,
    },
  },
} satisfies Prisma.ProductInclude;

export const productWithCategory = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} satisfies Prisma.ProductInclude;

export const productWithVariants = {
  variants: {
    orderBy: {
      position: 'asc' as const,
    },
  },
} satisfies Prisma.ProductInclude;

export const productFull = {
  ...productWithImages,
  ...productWithCategory,
  ...productWithVariants,
  reviews: {
    where: {
      isApproved: true,
    },
    take: 10,
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
} satisfies Prisma.ProductInclude;

// =============================================================================
// ORDER INCLUDE TYPES
// =============================================================================

export const orderWithItems = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

export const orderWithCustomer = {
  customer: {
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      totalOrders: true,
      totalSpent: true,
    },
  },
} satisfies Prisma.OrderInclude;

export const orderWithTimeline = {
  timeline: {
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
} satisfies Prisma.OrderInclude;

export const orderFull = {
  ...orderWithItems,
  ...orderWithCustomer,
  ...orderWithTimeline,
} satisfies Prisma.OrderInclude;

// =============================================================================
// CUSTOMER INCLUDE TYPES
// =============================================================================

export const customerWithOrders = {
  orders: {
    take: 10,
    orderBy: {
      createdAt: 'desc' as const,
    },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      status: true,
      createdAt: true,
    },
  },
} satisfies Prisma.CustomerInclude;

// =============================================================================
// SELECT TYPES FOR PERFORMANCE
// =============================================================================

export const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  status: true,
  preferredLanguage: true,
  mfaEnabled: true,
  emailVerified: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export const productListSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  price: true,
  compareAtPrice: true,
  quantity: true,
  status: true,
  totalSold: true,
  createdAt: true,
  images: {
    take: 1,
    orderBy: {
      position: 'asc' as const,
    },
    select: {
      id: true,
      url: true,
      alt: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ProductSelect;

export const orderListSelect = {
  id: true,
  orderNumber: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  total: true,
  currency: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  carrierName: true,
  trackingNumber: true,
  createdAt: true,
  items: {
    take: 3,
    select: {
      name: true,
      quantity: true,
      imageUrl: true,
    },
  },
  _count: {
    select: {
      items: true,
    },
  },
} satisfies Prisma.OrderSelect;

export const customerListSelect = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  totalOrders: true,
  totalSpent: true,
  lastOrderAt: true,
  firstOrderAt: true,
  status: true,
  createdAt: true,
} satisfies Prisma.CustomerSelect;

// =============================================================================
// FILTER TYPES
// =============================================================================

export interface ProductFilter {
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  lowStock?: boolean;
  search?: string;
  tags?: string[];
}

export interface OrderFilter {
  status?: string | string[];
  paymentStatus?: string;
  paymentMethod?: string;
  source?: string;
  customerId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  minTotal?: number;
  maxTotal?: number;
}

export interface CustomerFilter {
  status?: 'ACTIVE' | 'BLOCKED';
  search?: string;
  hasEmail?: boolean;
  minOrders?: number;
  maxOrders?: number;
  minSpent?: number;
  maxSpent?: number;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}
