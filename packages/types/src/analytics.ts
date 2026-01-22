/**
 * Analytics types
 */

import type { UUID, DateRangeFilter } from './common';

// Time period
export enum TimePeriod {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = '7d',
  LAST_30_DAYS = '30d',
  LAST_90_DAYS = '90d',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_YEAR = 'this_year',
  ALL_TIME = 'all_time',
  CUSTOM = 'custom',
}

// Metric type
export enum MetricType {
  COUNT = 'count',
  SUM = 'sum',
  AVERAGE = 'average',
  PERCENTAGE = 'percentage',
  RATE = 'rate',
}

// =============================================================================
// DASHBOARD METRICS
// =============================================================================

export interface DashboardMetrics {
  readonly period: TimePeriod;
  readonly dateRange: DateRangeFilter;
  readonly sales: SalesMetrics;
  readonly orders: OrderMetrics;
  readonly customers: CustomerMetrics;
  readonly products: ProductMetrics;
  readonly conversion: ConversionMetrics;
}

export interface SalesMetrics {
  readonly totalRevenue: number;
  readonly revenueChange: number;
  readonly averageOrderValue: number;
  readonly aovChange: number;
  readonly revenueByDay: readonly DataPoint[];
  readonly revenueByProduct: readonly ProductRevenue[];
}

export interface OrderMetrics {
  readonly totalOrders: number;
  readonly ordersChange: number;
  readonly confirmationRate: number;
  readonly deliveryRate: number;
  readonly pendingOrders: number;
  readonly confirmedOrders: number;
  readonly shippedOrders: number;
  readonly deliveredOrders: number;
  readonly cancelledOrders: number;
  readonly ordersByStatus: readonly StatusCount[];
  readonly ordersByDay: readonly DataPoint[];
}

export interface CustomerMetrics {
  readonly totalCustomers: number;
  readonly customersChange: number;
  readonly newCustomers: number;
  readonly repeatCustomers: number;
  readonly repeatRate: number;
  readonly averageCustomerValue: number;
  readonly topCustomers: readonly TopCustomerMetric[];
}

export interface ProductMetrics {
  readonly totalProducts: number;
  readonly activeProducts: number;
  readonly draftProducts: number;
  readonly lowStockProducts: number;
  readonly outOfStockProducts: number;
  readonly totalStockValue: number;
  readonly topSellingProducts: readonly ProductSalesMetric[];
  readonly productsByCategory: readonly CategoryMetric[];
}

export interface ConversionMetrics {
  readonly totalVisits: number;
  readonly visitsChange: number;
  readonly totalOrders: number;
  readonly conversionRate: number;
  readonly conversionRateChange: number;
  readonly visitorsToday: number;
  readonly conversionFunnel: ConversionFunnel;
  readonly trafficSources: readonly TrafficSource[];
  readonly periodComparison: PeriodComparison;
}

// =============================================================================
// DATA STRUCTURES
// =============================================================================

export interface DataPoint {
  readonly date: string;
  readonly value: number;
  readonly label?: string;
}

export interface StatusCount {
  readonly status: string;
  readonly count: number;
  readonly percentage: number;
}

export interface ProductRevenue {
  readonly productId: UUID;
  readonly productName: string;
  readonly revenue: number;
  readonly quantity: number;
  readonly percentage: number;
}

export interface ProductSalesMetric {
  readonly productId: UUID;
  readonly productName: string;
  readonly productImage?: string;
  readonly totalSold: number;
  readonly totalRevenue: number;
  readonly averagePrice: number;
}

export interface CategoryMetric {
  readonly categoryId?: UUID;
  readonly categoryName: string;
  readonly productCount: number;
  readonly percentage: number;
}

export interface TopCustomerMetric {
  readonly customerId: UUID;
  readonly customerName: string;
  readonly totalOrders: number;
  readonly totalSpent: number;
}

export interface TrafficSource {
  readonly source: string;
  readonly visits: number;
  readonly orders: number;
  readonly conversionRate: number;
  readonly percentage: number;
}

export interface ConversionFunnel {
  readonly visits: number;
  readonly productViews: number;
  readonly addToCarts: number;
  readonly checkouts: number;
  readonly purchases: number;
}

export interface PeriodComparison {
  readonly current: {
    readonly visits: number;
    readonly conversionRate: number;
  };
  readonly previous: {
    readonly visits: number;
    readonly conversionRate: number;
  };
  readonly change: {
    readonly visits: number;
    readonly conversionRate: number;
  };
}

// =============================================================================
// TEAM ANALYTICS
// =============================================================================

export interface TeamAnalytics {
  readonly totalMembers: number;
  readonly activeMembers: number;
  readonly pendingInvites: number;
  readonly rolesCount: number;
  readonly membersByRole: readonly RoleCount[];
  readonly members: readonly TeamMemberActivity[];
}

export interface RoleCount {
  readonly role: string;
  readonly count: number;
  readonly percentage: number;
}

export interface TeamMemberActivity {
  readonly userId: UUID;
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly lastLoginAt?: Date;
  readonly actionsCount: number;
}

// =============================================================================
// PROFIT CALCULATOR
// =============================================================================

export interface ProfitCalculatorInput {
  // Costs
  readonly deliveryCost: number;
  readonly returnCost: number;
  readonly fulfillmentCost: number;

  // Product & Leads
  readonly productCost: number;
  readonly leadCost: number;
  readonly totalLeads: number;

  // Rates & Revenue
  readonly confirmationRate: number;
  readonly deliveryRate: number;
  readonly sellingPrice: number;
}

export interface ProfitCalculatorResult {
  readonly input: ProfitCalculatorInput;
  readonly calculations: {
    readonly confirmedOrders: number;
    readonly deliveredOrders: number;
    readonly returnedOrders: number;
    readonly grossRevenue: number;
    readonly totalProductCost: number;
    readonly totalDeliveryCost: number;
    readonly totalReturnCost: number;
    readonly totalFulfillmentCost: number;
    readonly totalLeadCost: number;
    readonly totalCosts: number;
    readonly netProfit: number;
    readonly profitMargin: number;
    readonly profitPerOrder: number;
    readonly breakEvenOrders: number;
    readonly roi: number;
  };
}

// =============================================================================
// REAL-TIME ANALYTICS
// =============================================================================

export interface RealTimeMetrics {
  readonly activeVisitors: number;
  readonly ordersLast24h: number;
  readonly revenueLast24h: number;
  readonly recentOrders: readonly RecentOrder[];
  readonly recentActivity: readonly ActivityItem[];
}

export interface RecentOrder {
  readonly id: UUID;
  readonly orderNumber: string;
  readonly customerName: string;
  readonly total: number;
  readonly status: string;
  readonly createdAt: Date;
}

export interface ActivityItem {
  readonly type: 'order' | 'visit' | 'product_view' | 'abandoned_cart';
  readonly message: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

// =============================================================================
// ANALYTICS EVENTS (for tracking)
// =============================================================================

export interface AnalyticsEvent {
  readonly id: UUID;
  readonly storeId: UUID;
  readonly sessionId: string;
  readonly visitorId: string;
  readonly eventType: AnalyticsEventType;
  readonly eventData: Record<string, unknown>;
  readonly pageUrl: string;
  readonly referrer?: string;
  readonly userAgent: string;
  readonly ipAddress: string;
  readonly country?: string;
  readonly city?: string;
  readonly deviceType: 'desktop' | 'mobile' | 'tablet';
  readonly timestamp: Date;
}

export enum AnalyticsEventType {
  PAGE_VIEW = 'page_view',
  PRODUCT_VIEW = 'product_view',
  ADD_TO_CART = 'add_to_cart',
  REMOVE_FROM_CART = 'remove_from_cart',
  CHECKOUT_STARTED = 'checkout_started',
  CHECKOUT_COMPLETED = 'checkout_completed',
  ORDER_PLACED = 'order_placed',
}

// =============================================================================
// EXPORT
// =============================================================================

export interface AnalyticsExportRequest {
  readonly type: 'sales' | 'orders' | 'customers' | 'products';
  readonly period: TimePeriod;
  readonly dateRange?: DateRangeFilter;
  readonly format: 'csv' | 'xlsx' | 'json';
}

export interface AnalyticsExportResponse {
  readonly downloadUrl: string;
  readonly expiresAt: Date;
  readonly fileName: string;
  readonly rowCount: number;
}
