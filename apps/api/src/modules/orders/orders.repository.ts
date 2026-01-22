/**
 * Orders Repository
 */

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { OrderStatus, PaymentStatus, FulfillmentStatus } from '@sellergo/types';

export interface OrderFilter {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  customerId?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly db: DatabaseService) {}

  async findById(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, name: true, slug: true } } } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        timelineEvents: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async findByOrderNumber(tenantId: string, storeId: string, orderNumber: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.order.findFirst({
      where: { storeId, orderNumber },
      include: {
        items: { include: { product: { select: { id: true, name: true, slug: true } } } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });
  }

  async findMany(tenantId: string, storeId: string, filter: OrderFilter, pagination: PaginationOptions) {
    const prisma = await this.db.withTenant(tenantId);
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

    const where: Record<string, unknown> = { storeId };
    if (filter.status) where.status = filter.status;
    if (filter.paymentStatus) where.paymentStatus = filter.paymentStatus;
    if (filter.fulfillmentStatus) where.fulfillmentStatus = filter.fulfillmentStatus;
    if (filter.customerId) where.customerId = filter.customerId;
    if (filter.search) {
      where.OR = [
        { orderNumber: { contains: filter.search, mode: 'insensitive' } },
        { customer: { email: { contains: filter.search, mode: 'insensitive' } } },
        { customer: { phone: { contains: filter.search, mode: 'insensitive' } } },
      ];
    }
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) (where.createdAt as Record<string, Date>).gte = filter.dateFrom;
      if (filter.dateTo) (where.createdAt as Record<string, Date>).lte = filter.dateTo;
    }

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          _count: { select: { items: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(tenantId: string, storeId: string, data: {
    orderNumber: string;
    customerId?: string;
    customerEmail: string;
    customerPhone?: string;
    customerFirstName: string;
    customerLastName: string;
    shippingAddress: Record<string, unknown>;
    billingAddress?: Record<string, unknown>;
    items: Array<{
      productId: string;
      variantId?: string;
      name: string;
      sku?: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      options?: Record<string, string>;
    }>;
    subtotal: number;
    shippingCost: number;
    discount: number;
    totalAmount: number;
    currency: string;
    notes?: string;
    source: string;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.order.create({
      data: {
        tenantId,
        storeId,
        orderNumber: data.orderNumber,
        customerId: data.customerId,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        customerFirstName: data.customerFirstName,
        customerLastName: data.customerLastName,
        shippingAddress: data.shippingAddress,
        billingAddress: data.billingAddress || data.shippingAddress,
        subtotal: data.subtotal,
        shippingCost: data.shippingCost,
        discount: data.discount,
        totalAmount: data.totalAmount,
        currency: data.currency,
        status: 'pending',
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'unfulfilled',
        notes: data.notes,
        source: data.source,
        items: {
          create: data.items.map((item, i) => ({
            tenantId,
            productId: item.productId,
            variantId: item.variantId,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            options: item.options || {},
          })),
        },
        timelineEvents: {
          create: {
            tenantId,
            type: 'created',
            title: 'Order created',
            description: `Order ${data.orderNumber} was placed`,
          },
        },
      },
      include: {
        items: true,
        customer: true,
      },
    });
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.order.update({ where: { id }, data });
  }

  async updateStatus(tenantId: string, id: string, status: OrderStatus) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.order.update({
      where: { id },
      data: { status },
    });
  }

  async updatePaymentStatus(tenantId: string, id: string, paymentStatus: PaymentStatus) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.order.update({
      where: { id },
      data: { paymentStatus, paidAt: paymentStatus === 'paid' ? new Date() : undefined },
    });
  }

  async updateFulfillmentStatus(tenantId: string, id: string, fulfillmentStatus: FulfillmentStatus) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.order.update({
      where: { id },
      data: { fulfillmentStatus, shippedAt: fulfillmentStatus === FulfillmentStatus.FULFILLED ? new Date() : undefined },
    });
  }

  async addTimelineEvent(tenantId: string, orderId: string, event: {
    type: string;
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.orderTimelineEvent.create({
      data: { tenantId, orderId, ...event },
    });
  }

  async getStatistics(tenantId: string, storeId: string, dateFrom?: Date, dateTo?: Date) {
    const prisma = await this.db.withTenant(tenantId);
    const where: Record<string, unknown> = { storeId };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Record<string, Date>).gte = dateFrom;
      if (dateTo) (where.createdAt as Record<string, Date>).lte = dateTo;
    }

    const [
      totalOrders,
      totalRevenue,
      confirmedOrders,
      deliveredOrders,
      cancelledOrders,
      averageOrderValue,
    ] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.aggregate({ where, _sum: { totalAmount: true } }),
      prisma.order.count({ where: { ...where, status: 'confirmed' } }),
      prisma.order.count({ where: { ...where, status: 'delivered' } }),
      prisma.order.count({ where: { ...where, status: 'cancelled' } }),
      prisma.order.aggregate({ where, _avg: { totalAmount: true } }),
    ]);

    return {
      totalOrders,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      confirmedOrders,
      deliveredOrders,
      cancelledOrders,
      averageOrderValue: averageOrderValue._avg.totalAmount || 0,
      confirmationRate: totalOrders > 0 ? (confirmedOrders / totalOrders) * 100 : 0,
      deliveryRate: confirmedOrders > 0 ? (deliveredOrders / confirmedOrders) * 100 : 0,
    };
  }

  async getOrdersByStatus(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    const result = await prisma.order.groupBy({
      by: ['status'],
      where: { storeId },
      _count: true,
    });
    return result.reduce((acc: Record<string, number>, { status, _count }: { status: string; _count: number }) => ({ ...acc, [status]: _count }), {} as Record<string, number>);
  }

  // Abandoned Carts
  async createAbandonedCart(tenantId: string, storeId: string, data: {
    sessionId: string;
    email?: string;
    phone?: string;
    items: Array<{ productId: string; variantId?: string; quantity: number; price: number }>;
    totalValue: number;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.abandonedCart.create({
      data: {
        tenantId,
        storeId,
        sessionId: data.sessionId,
        email: data.email,
        phone: data.phone,
        items: data.items,
        totalValue: data.totalValue,
        status: 'active',
      },
    });
  }

  async updateAbandonedCart(tenantId: string, id: string, data: Record<string, unknown>) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.abandonedCart.update({ where: { id }, data });
  }

  async getAbandonedCarts(tenantId: string, storeId: string, pagination: PaginationOptions) {
    const prisma = await this.db.withTenant(tenantId);
    const { page, limit } = pagination;
    const [items, total] = await Promise.all([
      prisma.abandonedCart.findMany({
        where: { storeId, status: 'active' },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.abandonedCart.count({ where: { storeId, status: 'active' } }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async recoverAbandonedCart(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.abandonedCart.update({
      where: { id },
      data: { status: 'recovered', recoveredAt: new Date() },
    });
  }

  async generateOrderNumber(storeId: string): Promise<string> {
    const date = new Date();
    const prefix = date.getFullYear().toString().slice(-2) +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${random}`;
  }
}
