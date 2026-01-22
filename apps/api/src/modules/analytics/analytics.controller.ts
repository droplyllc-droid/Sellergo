/**
 * Analytics Controller
 */

import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, Ip, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { StoreGuard } from '../auth/guards/store.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SkipStoreCheck } from '../auth/decorators/skip-store-check.decorator';
import { SkipTenantCheck } from '../auth/decorators/skip-tenant-check.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Permission, TimePeriod } from '@sellergo/types';
import { DashboardQueryDto, TopProductsQueryDto, ProfitCalculatorDto, TrackEventDto } from './dto';

@ApiTags('Analytics')
@Controller('stores/:storeId/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // Protected endpoints
  @Get('dashboard')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.ANALYTICS_READ)
  @ApiOperation({ summary: 'Get dashboard metrics' })
  async getDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query() query: DashboardQueryDto,
  ) {
    const customRange = query.startDate && query.endDate
      ? { startDate: new Date(query.startDate), endDate: new Date(query.endDate) }
      : undefined;

    return this.analyticsService.getDashboardMetrics(
      user.tenantId,
      storeId,
      query.period || TimePeriod.LAST_30_DAYS,
      customRange,
    );
  }

  @Get('sales')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.ANALYTICS_READ)
  @ApiOperation({ summary: 'Get sales analytics' })
  async getSalesAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query() query: DashboardQueryDto,
  ) {
    const dateRange = query.startDate && query.endDate
      ? { startDate: new Date(query.startDate), endDate: new Date(query.endDate) }
      : this.getDateRangeFromPeriod(query.period || TimePeriod.LAST_30_DAYS);

    return this.analyticsService.getSalesMetrics(user.tenantId, storeId, dateRange);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.ANALYTICS_READ)
  @ApiOperation({ summary: 'Get order analytics' })
  async getOrderAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query() query: DashboardQueryDto,
  ) {
    const dateRange = query.startDate && query.endDate
      ? { startDate: new Date(query.startDate), endDate: new Date(query.endDate) }
      : this.getDateRangeFromPeriod(query.period || TimePeriod.LAST_30_DAYS);

    return this.analyticsService.getOrderMetrics(user.tenantId, storeId, dateRange);
  }

  @Get('customers')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.ANALYTICS_READ)
  @ApiOperation({ summary: 'Get customer analytics' })
  async getCustomerAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query() query: DashboardQueryDto,
  ) {
    const dateRange = query.startDate && query.endDate
      ? { startDate: new Date(query.startDate), endDate: new Date(query.endDate) }
      : this.getDateRangeFromPeriod(query.period || TimePeriod.LAST_30_DAYS);

    return this.analyticsService.getCustomerMetrics(user.tenantId, storeId, dateRange);
  }

  @Get('products')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.ANALYTICS_READ)
  @ApiOperation({ summary: 'Get product analytics' })
  async getProductAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query() query: DashboardQueryDto,
  ) {
    const dateRange = query.startDate && query.endDate
      ? { startDate: new Date(query.startDate), endDate: new Date(query.endDate) }
      : this.getDateRangeFromPeriod(query.period || TimePeriod.LAST_30_DAYS);

    return this.analyticsService.getProductMetrics(user.tenantId, storeId, dateRange);
  }

  @Get('realtime')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.ANALYTICS_READ)
  @ApiOperation({ summary: 'Get real-time metrics' })
  async getRealTimeMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.analyticsService.getRealTimeMetrics(user.tenantId, storeId);
  }

  @Get('top-products')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.ANALYTICS_READ)
  @ApiOperation({ summary: 'Get top selling products' })
  async getTopProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query() query: TopProductsQueryDto,
  ) {
    return this.analyticsService.getTopSellingProducts(
      user.tenantId,
      storeId,
      query.period || TimePeriod.LAST_30_DAYS,
      query.limit,
    );
  }

  @Get('top-customers')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.ANALYTICS_READ)
  @ApiOperation({ summary: 'Get top customers' })
  async getTopCustomers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query('limit') limit?: number,
  ) {
    return this.analyticsService.getTopCustomers(user.tenantId, storeId, limit || 10);
  }

  @Post('profit-calculator')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.ANALYTICS_READ)
  @ApiOperation({ summary: 'Calculate profit projections' })
  @ApiResponse({ status: 200, description: 'Profit calculation result' })
  async calculateProfit(@Body() dto: ProfitCalculatorDto) {
    return this.analyticsService.calculateProfit(dto);
  }

  // Public tracking endpoint (for storefront)
  @Post('track')
  @Public()
  @SkipStoreCheck()
  @SkipTenantCheck()
  @ApiOperation({ summary: 'Track analytics event (public)' })
  @ApiResponse({ status: 201, description: 'Event tracked' })
  async trackEvent(
    @Param('storeId') storeId: string,
    @Body() dto: TrackEventDto,
    @Ip() ip: string,
    @Headers('x-forwarded-for') forwardedFor?: string,
  ) {
    const ipAddress = forwardedFor?.split(',')[0] || ip || 'unknown';

    // For public endpoint, we need to resolve tenantId from store
    // This would typically be done via a middleware or by looking up the store
    const tenantId = ''; // Will be resolved from store lookup

    return this.analyticsService.trackEvent(tenantId, storeId, {
      ...dto,
      eventData: dto.eventData || {},
      ipAddress,
      deviceType: dto.deviceType || 'desktop',
    });
  }

  // Helper method
  private getDateRangeFromPeriod(period: TimePeriod) {
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
}
