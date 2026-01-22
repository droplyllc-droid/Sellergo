/**
 * Analytics Service
 */

import { Injectable } from '@nestjs/common';
import { AnalyticsRepository, DateRange } from './analytics.repository';
import { RedisService } from '../../core/redis/redis.service';
import { TimePeriod } from '@sellergo/types';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly redisService: RedisService,
  ) {}

  async getDashboardMetrics(tenantId: string, storeId: string, period: TimePeriod, customRange?: DateRange) {
    const dateRange = customRange || this.getDateRange(period);
    const previousRange = this.getPreviousRange(dateRange);

    const cacheKey = `analytics:dashboard:${storeId}:${period}:${dateRange.startDate.toISOString()}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    const [sales, orders, customers, products, conversion] = await Promise.all([
      this.getSalesMetrics(tenantId, storeId, dateRange, previousRange),
      this.getOrderMetrics(tenantId, storeId, dateRange, previousRange),
      this.getCustomerMetrics(tenantId, storeId, dateRange, previousRange),
      this.getProductMetrics(tenantId, storeId, dateRange),
      this.getConversionMetrics(tenantId, storeId, dateRange, previousRange),
    ]);

    const result = {
      period,
      dateRange: { startDate: dateRange.startDate, endDate: dateRange.endDate },
      sales,
      orders,
      customers,
      products,
      conversion,
    };

    // Cache for 5 minutes
    await this.redisService.set(cacheKey, result, 300);

    return result;
  }

  async getSalesMetrics(tenantId: string, storeId: string, dateRange: DateRange, previousRange?: DateRange) {
    const [metrics, revenueByDay, revenueByProduct] = await Promise.all([
      this.analyticsRepository.getSalesMetrics(tenantId, storeId, dateRange, previousRange),
      this.analyticsRepository.getRevenueByDay(tenantId, storeId, dateRange),
      this.analyticsRepository.getRevenueByProduct(tenantId, storeId, dateRange),
    ]);

    return { ...metrics, revenueByDay, revenueByProduct };
  }

  async getOrderMetrics(tenantId: string, storeId: string, dateRange: DateRange, previousRange?: DateRange) {
    const [metrics, ordersByStatus, ordersByDay] = await Promise.all([
      this.analyticsRepository.getOrderMetrics(tenantId, storeId, dateRange, previousRange),
      this.analyticsRepository.getOrdersByStatus(tenantId, storeId, dateRange),
      this.analyticsRepository.getOrdersByDay(tenantId, storeId, dateRange),
    ]);

    return { ...metrics, ordersByStatus, ordersByDay };
  }

  async getCustomerMetrics(tenantId: string, storeId: string, dateRange: DateRange, previousRange?: DateRange) {
    const [metrics, topCustomers] = await Promise.all([
      this.analyticsRepository.getCustomerMetrics(tenantId, storeId, dateRange, previousRange),
      this.analyticsRepository.getTopCustomers(tenantId, storeId),
    ]);

    return { ...metrics, topCustomers };
  }

  async getProductMetrics(tenantId: string, storeId: string, dateRange: DateRange) {
    const [metrics, topSellingProducts, productsByCategory] = await Promise.all([
      this.analyticsRepository.getProductMetrics(tenantId, storeId),
      this.analyticsRepository.getTopSellingProducts(tenantId, storeId, dateRange),
      this.analyticsRepository.getProductsByCategory(tenantId, storeId),
    ]);

    return { ...metrics, topSellingProducts, productsByCategory };
  }

  async getConversionMetrics(tenantId: string, storeId: string, dateRange: DateRange, previousRange?: DateRange) {
    const [visitorStats, prevVisitorStats, funnel, trafficSources, orderCount, prevOrderCount] = await Promise.all([
      this.analyticsRepository.getVisitorStats(tenantId, storeId, dateRange),
      previousRange
        ? this.analyticsRepository.getVisitorStats(tenantId, storeId, previousRange)
        : Promise.resolve({ totalVisits: 0, uniqueVisitors: 0 }),
      this.analyticsRepository.getConversionFunnel(tenantId, storeId, dateRange),
      this.analyticsRepository.getTrafficSources(tenantId, storeId, dateRange),
      this.analyticsRepository.getOrderMetrics(tenantId, storeId, dateRange),
      previousRange
        ? this.analyticsRepository.getOrderMetrics(tenantId, storeId, previousRange)
        : Promise.resolve({ totalOrders: 0 }),
    ]);

    const conversionRate = visitorStats.totalVisits > 0
      ? (orderCount.totalOrders / visitorStats.totalVisits) * 100
      : 0;
    const prevConversionRate = prevVisitorStats.totalVisits > 0
      ? (prevOrderCount.totalOrders / prevVisitorStats.totalVisits) * 100
      : 0;

    return {
      totalVisits: visitorStats.totalVisits,
      visitsChange: prevVisitorStats.totalVisits > 0
        ? ((visitorStats.totalVisits - prevVisitorStats.totalVisits) / prevVisitorStats.totalVisits) * 100
        : 0,
      totalOrders: orderCount.totalOrders,
      conversionRate,
      conversionRateChange: prevConversionRate > 0
        ? ((conversionRate - prevConversionRate) / prevConversionRate) * 100
        : 0,
      visitorsToday: visitorStats.uniqueVisitors,
      conversionFunnel: funnel,
      trafficSources,
      periodComparison: {
        current: { visits: visitorStats.totalVisits, conversionRate },
        previous: { visits: prevVisitorStats.totalVisits, conversionRate: prevConversionRate },
        change: {
          visits: visitorStats.totalVisits - prevVisitorStats.totalVisits,
          conversionRate: conversionRate - prevConversionRate,
        },
      },
    };
  }

  async getRealTimeMetrics(tenantId: string, storeId: string) {
    const [last24h, recentOrders, activeVisitors] = await Promise.all([
      this.analyticsRepository.getOrdersLast24h(tenantId, storeId),
      this.analyticsRepository.getRecentOrders(tenantId, storeId),
      this.getActiveVisitors(storeId),
    ]);

    return {
      activeVisitors,
      ordersLast24h: last24h.ordersLast24h,
      revenueLast24h: last24h.revenueLast24h,
      recentOrders,
      recentActivity: [], // Would come from activity tracking
    };
  }

  async getTopSellingProducts(tenantId: string, storeId: string, period: TimePeriod, limit = 10) {
    const dateRange = this.getDateRange(period);
    return this.analyticsRepository.getTopSellingProducts(tenantId, storeId, dateRange, limit);
  }

  async getTopCustomers(tenantId: string, storeId: string, limit = 10) {
    return this.analyticsRepository.getTopCustomers(tenantId, storeId, limit);
  }

  // Profit Calculator
  calculateProfit(input: {
    deliveryCost: number;
    returnCost: number;
    fulfillmentCost: number;
    productCost: number;
    leadCost: number;
    totalLeads: number;
    confirmationRate: number;
    deliveryRate: number;
    sellingPrice: number;
  }) {
    const confirmedOrders = Math.round(input.totalLeads * (input.confirmationRate / 100));
    const deliveredOrders = Math.round(confirmedOrders * (input.deliveryRate / 100));
    const returnedOrders = confirmedOrders - deliveredOrders;

    const grossRevenue = deliveredOrders * input.sellingPrice;
    const totalProductCost = confirmedOrders * input.productCost;
    const totalDeliveryCost = confirmedOrders * input.deliveryCost;
    const totalReturnCost = returnedOrders * input.returnCost;
    const totalFulfillmentCost = confirmedOrders * input.fulfillmentCost;
    const totalLeadCost = input.totalLeads * input.leadCost;

    const totalCosts = totalProductCost + totalDeliveryCost + totalReturnCost + totalFulfillmentCost + totalLeadCost;
    const netProfit = grossRevenue - totalCosts;
    const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
    const profitPerOrder = deliveredOrders > 0 ? netProfit / deliveredOrders : 0;

    const costPerDeliveredOrder = deliveredOrders > 0 ? totalCosts / deliveredOrders : 0;
    const breakEvenOrders = costPerDeliveredOrder > 0
      ? Math.ceil(totalCosts / (input.sellingPrice - costPerDeliveredOrder))
      : 0;

    const roi = totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0;

    return {
      input,
      calculations: {
        confirmedOrders,
        deliveredOrders,
        returnedOrders,
        grossRevenue,
        totalProductCost,
        totalDeliveryCost,
        totalReturnCost,
        totalFulfillmentCost,
        totalLeadCost,
        totalCosts,
        netProfit,
        profitMargin,
        profitPerOrder,
        breakEvenOrders,
        roi,
      },
    };
  }

  // Track analytics event
  async trackEvent(tenantId: string, storeId: string, event: {
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
    // Track active visitors in Redis
    if (event.eventType === 'page_view') {
      await this.redisService.set(`visitors:${storeId}:${event.visitorId}`, '1', 300); // 5 min TTL
    }

    return this.analyticsRepository.recordEvent(tenantId, storeId, event);
  }

  // Helpers
  private async getActiveVisitors(storeId: string): Promise<number> {
    const keys = await this.redisService.keys(`visitors:${storeId}:*`);
    return keys.length;
  }

  private getDateRange(period: TimePeriod): DateRange {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);

    switch (period) {
      case TimePeriod.TODAY:
        return { startDate: today, endDate };

      case TimePeriod.YESTERDAY:
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return { startDate: yesterday, endDate: new Date(today.getTime() - 1) };

      case TimePeriod.LAST_7_DAYS:
        return { startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), endDate };

      case TimePeriod.LAST_30_DAYS:
        return { startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), endDate };

      case TimePeriod.LAST_90_DAYS:
        return { startDate: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000), endDate };

      case TimePeriod.THIS_MONTH:
        return { startDate: new Date(now.getFullYear(), now.getMonth(), 1), endDate };

      case TimePeriod.LAST_MONTH:
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return { startDate: lastMonth, endDate: lastMonthEnd };

      case TimePeriod.THIS_YEAR:
        return { startDate: new Date(now.getFullYear(), 0, 1), endDate };

      case TimePeriod.ALL_TIME:
        return { startDate: new Date(2020, 0, 1), endDate };

      default:
        return { startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), endDate };
    }
  }

  private getPreviousRange(currentRange: DateRange): DateRange {
    const duration = currentRange.endDate.getTime() - currentRange.startDate.getTime();
    return {
      startDate: new Date(currentRange.startDate.getTime() - duration),
      endDate: new Date(currentRange.startDate.getTime() - 1),
    };
  }
}
