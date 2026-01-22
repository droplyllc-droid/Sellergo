/**
 * Analytics Repository
 */

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly db: DatabaseService) {}

  // Sales Analytics
  async getSalesMetrics(tenantId: string, storeId: string, dateRange: DateRange, previousRange?: DateRange) {
    const prisma = await this.db.withTenant(tenantId);
    const where = {
      storeId,
      createdAt: { gte: dateRange.startDate, lte: dateRange.endDate },
      status: { not: 'cancelled' },
    };

    const [totalRevenue, orderCount, previousRevenue, previousOrderCount] = await Promise.all([
      prisma.order.aggregate({ where, _sum: { totalAmount: true } }),
      prisma.order.count({ where }),
      previousRange
        ? prisma.order.aggregate({
            where: { ...where, createdAt: { gte: previousRange.startDate, lte: previousRange.endDate } },
            _sum: { totalAmount: true },
          })
        : Promise.resolve({ _sum: { totalAmount: null } }),
      previousRange
        ? prisma.order.count({
            where: { ...where, createdAt: { gte: previousRange.startDate, lte: previousRange.endDate } },
          })
        : Promise.resolve(0),
    ]);

    const revenue = totalRevenue._sum.totalAmount || 0;
    const prevRevenue = previousRevenue._sum.totalAmount || 0;
    const aov = orderCount > 0 ? revenue / orderCount : 0;
    const prevAov = previousOrderCount > 0 ? prevRevenue / previousOrderCount : 0;

    return {
      totalRevenue: revenue,
      revenueChange: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0,
      averageOrderValue: aov,
      aovChange: prevAov > 0 ? ((aov - prevAov) / prevAov) * 100 : 0,
    };
  }

  async getRevenueByDay(tenantId: string, storeId: string, dateRange: DateRange) {
    const prisma = await this.db.withTenant(tenantId);
    const orders = await prisma.order.findMany({
      where: {
        storeId,
        createdAt: { gte: dateRange.startDate, lte: dateRange.endDate },
        status: { not: 'cancelled' },
      },
      select: { createdAt: true, totalAmount: true },
    });

    const revenueByDay = new Map<string, number>();
    for (const order of orders) {
      const date = order.createdAt.toISOString().split('T')[0];
      revenueByDay.set(date, (revenueByDay.get(date) || 0) + order.totalAmount);
    }

    return Array.from(revenueByDay.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getRevenueByProduct(tenantId: string, storeId: string, dateRange: DateRange, limit = 10) {
    const prisma = await this.db.withTenant(tenantId);
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          storeId,
          createdAt: { gte: dateRange.startDate, lte: dateRange.endDate },
          status: { not: 'cancelled' },
        },
      },
      include: { product: { select: { id: true, name: true } } },
    });

    const productRevenue = new Map<string, { name: string; revenue: number; quantity: number }>();
    let totalRevenue = 0;

    for (const item of orderItems) {
      const key = item.productId;
      const current = productRevenue.get(key) || { name: item.product?.name || item.name, revenue: 0, quantity: 0 };
      current.revenue += item.totalPrice;
      current.quantity += item.quantity;
      totalRevenue += item.totalPrice;
      productRevenue.set(key, current);
    }

    return Array.from(productRevenue.entries())
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        revenue: data.revenue,
        quantity: data.quantity,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  // Order Analytics
  async getOrderMetrics(tenantId: string, storeId: string, dateRange: DateRange, previousRange?: DateRange) {
    const prisma = await this.db.withTenant(tenantId);
    const where = { storeId, createdAt: { gte: dateRange.startDate, lte: dateRange.endDate } };

    const [
      totalOrders,
      previousOrders,
      pendingOrders,
      confirmedOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
    ] = await Promise.all([
      prisma.order.count({ where }),
      previousRange
        ? prisma.order.count({
            where: { storeId, createdAt: { gte: previousRange.startDate, lte: previousRange.endDate } },
          })
        : Promise.resolve(0),
      prisma.order.count({ where: { ...where, status: 'pending' } }),
      prisma.order.count({ where: { ...where, status: 'confirmed' } }),
      prisma.order.count({ where: { ...where, status: 'shipped' } }),
      prisma.order.count({ where: { ...where, status: 'delivered' } }),
      prisma.order.count({ where: { ...where, status: 'cancelled' } }),
    ]);

    const confirmationRate = totalOrders > 0 ? ((confirmedOrders + shippedOrders + deliveredOrders) / totalOrders) * 100 : 0;
    const deliveryRate = confirmedOrders + shippedOrders + deliveredOrders > 0
      ? (deliveredOrders / (confirmedOrders + shippedOrders + deliveredOrders)) * 100
      : 0;

    return {
      totalOrders,
      ordersChange: previousOrders > 0 ? ((totalOrders - previousOrders) / previousOrders) * 100 : 0,
      confirmationRate,
      deliveryRate,
      pendingOrders,
      confirmedOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
    };
  }

  async getOrdersByStatus(tenantId: string, storeId: string, dateRange: DateRange) {
    const prisma = await this.db.withTenant(tenantId);
    const result = await prisma.order.groupBy({
      by: ['status'],
      where: { storeId, createdAt: { gte: dateRange.startDate, lte: dateRange.endDate } },
      _count: true,
    });

    const total = result.reduce((sum: number, r: { status: string; _count: number }) => sum + r._count, 0);
    return result.map((r: { status: string; _count: number }) => ({
      status: r.status,
      count: r._count,
      percentage: total > 0 ? (r._count / total) * 100 : 0,
    }));
  }

  async getOrdersByDay(tenantId: string, storeId: string, dateRange: DateRange) {
    const prisma = await this.db.withTenant(tenantId);
    const orders = await prisma.order.findMany({
      where: { storeId, createdAt: { gte: dateRange.startDate, lte: dateRange.endDate } },
      select: { createdAt: true },
    });

    const ordersByDay = new Map<string, number>();
    for (const order of orders) {
      const date = order.createdAt.toISOString().split('T')[0];
      ordersByDay.set(date, (ordersByDay.get(date) || 0) + 1);
    }

    return Array.from(ordersByDay.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Customer Analytics
  async getCustomerMetrics(tenantId: string, storeId: string, dateRange: DateRange, previousRange?: DateRange) {
    const prisma = await this.db.withTenant(tenantId);
    const where = { storeId, createdAt: { gte: dateRange.startDate, lte: dateRange.endDate } };

    const [
      totalCustomers,
      newCustomers,
      previousCustomers,
      repeatCustomers,
      totalSpent,
    ] = await Promise.all([
      prisma.customer.count({ where: { storeId } }),
      prisma.customer.count({ where }),
      previousRange
        ? prisma.customer.count({
            where: { storeId, createdAt: { gte: previousRange.startDate, lte: previousRange.endDate } },
          })
        : Promise.resolve(0),
      prisma.customer.count({ where: { storeId, totalOrders: { gte: 2 } } }),
      prisma.customer.aggregate({ where: { storeId }, _sum: { totalSpent: true } }),
    ]);

    return {
      totalCustomers,
      customersChange: previousCustomers > 0 ? ((newCustomers - previousCustomers) / previousCustomers) * 100 : 0,
      newCustomers,
      repeatCustomers,
      repeatRate: totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0,
      averageCustomerValue: totalCustomers > 0 ? (totalSpent._sum.totalSpent || 0) / totalCustomers : 0,
    };
  }

  async getTopCustomers(tenantId: string, storeId: string, limit = 10) {
    const prisma = await this.db.withTenant(tenantId);
    const customers = await prisma.customer.findMany({
      where: { storeId, totalOrders: { gt: 0 } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        totalOrders: true,
        totalSpent: true,
      },
      orderBy: { totalSpent: 'desc' },
      take: limit,
    });

    return customers.map((c: { id: string; firstName: string | null; lastName: string | null; phone: string; totalOrders: number; totalSpent: number }) => ({
      customerId: c.id,
      customerName: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone,
      totalOrders: c.totalOrders,
      totalSpent: c.totalSpent,
    }));
  }

  // Product Analytics
  async getProductMetrics(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);

    const [
      totalProducts,
      activeProducts,
      draftProducts,
      lowStockProducts,
      outOfStockProducts,
      stockValue,
    ] = await Promise.all([
      prisma.product.count({ where: { storeId } }),
      prisma.product.count({ where: { storeId, status: 'active' } }),
      prisma.product.count({ where: { storeId, status: 'draft' } }),
      prisma.product.count({ where: { storeId, trackQuantity: true, quantity: { gt: 0, lte: 10 } } }),
      prisma.product.count({ where: { storeId, trackQuantity: true, quantity: 0 } }),
      prisma.product.aggregate({
        where: { storeId, trackQuantity: true },
        _sum: { quantity: true },
      }),
    ]);

    // Calculate stock value (quantity * cost or price)
    const products = await prisma.product.findMany({
      where: { storeId, trackQuantity: true },
      select: { quantity: true, price: true },
    });
    const totalStockValue = products.reduce((sum: number, p: { quantity: number; price: number }) => sum + p.quantity * p.price, 0);

    return {
      totalProducts,
      activeProducts,
      draftProducts,
      lowStockProducts,
      outOfStockProducts,
      totalStockValue,
    };
  }

  async getTopSellingProducts(tenantId: string, storeId: string, dateRange: DateRange, limit = 10) {
    const prisma = await this.db.withTenant(tenantId);
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          storeId,
          createdAt: { gte: dateRange.startDate, lte: dateRange.endDate },
          status: { not: 'cancelled' },
        },
      },
      include: { product: { select: { id: true, name: true, images: true } } },
    });

    const productSales = new Map<string, { name: string; image?: string; sold: number; revenue: number }>();

    for (const item of orderItems) {
      const key = item.productId;
      const current = productSales.get(key) || {
        name: item.product?.name || item.name,
        image: (item.product?.images as Array<{ url: string }>)?.[0]?.url,
        sold: 0,
        revenue: 0,
      };
      current.sold += item.quantity;
      current.revenue += item.totalPrice;
      productSales.set(key, current);
    }

    return Array.from(productSales.entries())
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        productImage: data.image,
        totalSold: data.sold,
        totalRevenue: data.revenue,
        averagePrice: data.sold > 0 ? data.revenue / data.sold : 0,
      }))
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, limit);
  }

  async getProductsByCategory(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    const products = await prisma.product.findMany({
      where: { storeId },
      include: { category: { select: { id: true, name: true } } },
    });

    const categoryCount = new Map<string, { name: string; count: number }>();
    let uncategorized = 0;

    for (const product of products) {
      if (product.category) {
        const current = categoryCount.get(product.category.id) || { name: product.category.name, count: 0 };
        current.count++;
        categoryCount.set(product.category.id, current);
      } else {
        uncategorized++;
      }
    }

    const total = products.length;
    const result = Array.from(categoryCount.entries()).map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      productCount: data.count,
      percentage: total > 0 ? (data.count / total) * 100 : 0,
    }));

    if (uncategorized > 0) {
      result.push({
        categoryId: undefined as unknown as string,
        categoryName: 'Uncategorized',
        productCount: uncategorized,
        percentage: total > 0 ? (uncategorized / total) * 100 : 0,
      });
    }

    return result.sort((a, b) => b.productCount - a.productCount);
  }

  // Real-time Analytics
  async getRecentOrders(tenantId: string, storeId: string, limit = 10) {
    const prisma = await this.db.withTenant(tenantId);
    const orders = await prisma.order.findMany({
      where: { storeId },
      select: {
        id: true,
        orderNumber: true,
        customerFirstName: true,
        customerLastName: true,
        totalAmount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return orders.map((o: { id: string; orderNumber: string; customerFirstName: string | null; customerLastName: string | null; totalAmount: number; status: string; createdAt: Date }) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: [o.customerFirstName, o.customerLastName].filter(Boolean).join(' '),
      total: o.totalAmount,
      status: o.status,
      createdAt: o.createdAt,
    }));
  }

  async getOrdersLast24h(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [count, revenue] = await Promise.all([
      prisma.order.count({ where: { storeId, createdAt: { gte: yesterday } } }),
      prisma.order.aggregate({
        where: { storeId, createdAt: { gte: yesterday }, status: { not: 'cancelled' } },
        _sum: { totalAmount: true },
      }),
    ]);

    return { ordersLast24h: count, revenueLast24h: revenue._sum.totalAmount || 0 };
  }

  // Analytics Events (for tracking)
  async recordEvent(tenantId: string, storeId: string, event: {
    sessionId: string;
    visitorId: string;
    eventType: string;
    eventData: Record<string, unknown>;
    pageUrl: string;
    referrer?: string;
    userAgent: string;
    ipAddress: string;
    country?: string;
    city?: string;
    deviceType: string;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.analyticsEvent.create({
      data: {
        tenantId,
        storeId,
        ...event,
        timestamp: new Date(),
      },
    });
  }

  async getVisitorStats(tenantId: string, storeId: string, dateRange: DateRange) {
    const prisma = await this.db.withTenant(tenantId);

    const [totalVisits, uniqueVisitors] = await Promise.all([
      prisma.analyticsEvent.count({
        where: {
          storeId,
          eventType: 'page_view',
          timestamp: { gte: dateRange.startDate, lte: dateRange.endDate },
        },
      }),
      prisma.analyticsEvent.groupBy({
        by: ['visitorId'],
        where: {
          storeId,
          eventType: 'page_view',
          timestamp: { gte: dateRange.startDate, lte: dateRange.endDate },
        },
      }),
    ]);

    return { totalVisits, uniqueVisitors: uniqueVisitors.length };
  }

  async getConversionFunnel(tenantId: string, storeId: string, dateRange: DateRange) {
    const prisma = await this.db.withTenant(tenantId);
    const where = { storeId, timestamp: { gte: dateRange.startDate, lte: dateRange.endDate } };

    const [visits, productViews, addToCarts, checkouts, purchases] = await Promise.all([
      prisma.analyticsEvent.count({ where: { ...where, eventType: 'page_view' } }),
      prisma.analyticsEvent.count({ where: { ...where, eventType: 'product_view' } }),
      prisma.analyticsEvent.count({ where: { ...where, eventType: 'add_to_cart' } }),
      prisma.analyticsEvent.count({ where: { ...where, eventType: 'checkout_started' } }),
      prisma.analyticsEvent.count({ where: { ...where, eventType: 'checkout_completed' } }),
    ]);

    return { visits, productViews, addToCarts, checkouts, purchases };
  }

  async getTrafficSources(tenantId: string, storeId: string, dateRange: DateRange) {
    const prisma = await this.db.withTenant(tenantId);
    const events = await prisma.analyticsEvent.findMany({
      where: {
        storeId,
        eventType: 'page_view',
        timestamp: { gte: dateRange.startDate, lte: dateRange.endDate },
      },
      select: { referrer: true, visitorId: true },
    });

    const sourceMap = new Map<string, { visits: Set<string> }>();

    for (const event of events) {
      let source = 'Direct';
      if (event.referrer) {
        try {
          const url = new URL(event.referrer);
          source = url.hostname.replace('www.', '');
        } catch {
          source = 'Unknown';
        }
      }
      const current = sourceMap.get(source) || { visits: new Set() };
      current.visits.add(event.visitorId);
      sourceMap.set(source, current);
    }

    const total = events.length;
    return Array.from(sourceMap.entries())
      .map(([source, data]) => ({
        source,
        visits: data.visits.size,
        orders: 0, // Would need to join with orders
        conversionRate: 0,
        percentage: total > 0 ? (data.visits.size / total) * 100 : 0,
      }))
      .sort((a, b) => b.visits - a.visits);
  }
}
