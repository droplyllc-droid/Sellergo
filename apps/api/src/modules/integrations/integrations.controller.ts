/**
 * Integrations Controller
 */

import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PixelsService } from './pixels.service';
import { WebhooksService } from './webhooks.service';
import { AppsService } from './apps.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { StoreGuard } from '../auth/guards/store.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Permission } from '@sellergo/types';
import {
  CreatePixelDto,
  UpdatePixelDto,
  CreateWebhookDto,
  UpdateWebhookDto,
  InstallAppDto,
  UpdateAppConfigDto,
  AppsQueryDto,
} from './dto';

@ApiTags('Integrations')
@Controller('stores/:storeId/integrations')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
@ApiBearerAuth()
export class IntegrationsController {
  constructor(
    private readonly pixelsService: PixelsService,
    private readonly webhooksService: WebhooksService,
    private readonly appsService: AppsService,
  ) {}

  // ==========================================================================
  // OVERVIEW
  // ==========================================================================

  @Get('status')
  @RequirePermissions(Permission.STORE_READ)
  @ApiOperation({ summary: 'Get integration status overview' })
  async getIntegrationStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.appsService.getIntegrationStatus(user.tenantId, storeId);
  }

  // ==========================================================================
  // PIXELS
  // ==========================================================================

  @Get('pixels')
  @RequirePermissions(Permission.STORE_READ)
  @ApiOperation({ summary: 'Get all ad pixels' })
  async getPixels(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.pixelsService.getPixels(user.tenantId, storeId);
  }

  @Get('pixels/:pixelId')
  @RequirePermissions(Permission.STORE_READ)
  @ApiOperation({ summary: 'Get pixel by ID' })
  async getPixel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pixelId') pixelId: string,
  ) {
    return this.pixelsService.getPixel(user.tenantId, pixelId);
  }

  @Post('pixels')
  @RequirePermissions(Permission.STORE_UPDATE)
  @ApiOperation({ summary: 'Create ad pixel' })
  @ApiResponse({ status: 201, description: 'Pixel created' })
  async createPixel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: CreatePixelDto,
  ) {
    return this.pixelsService.createPixel(user.tenantId, storeId, dto);
  }

  @Patch('pixels/:pixelId')
  @RequirePermissions(Permission.STORE_UPDATE)
  @ApiOperation({ summary: 'Update pixel' })
  async updatePixel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pixelId') pixelId: string,
    @Body() dto: UpdatePixelDto,
  ) {
    return this.pixelsService.updatePixel(user.tenantId, pixelId, dto);
  }

  @Delete('pixels/:pixelId')
  @RequirePermissions(Permission.STORE_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete pixel' })
  async deletePixel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pixelId') pixelId: string,
  ) {
    return this.pixelsService.deletePixel(user.tenantId, pixelId);
  }

  @Post('pixels/:pixelId/toggle')
  @RequirePermissions(Permission.STORE_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle pixel enabled/disabled' })
  async togglePixel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pixelId') pixelId: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.pixelsService.togglePixel(user.tenantId, pixelId, body.enabled);
  }

  @Get('pixels/:pixelId/script')
  @RequirePermissions(Permission.STORE_READ)
  @ApiOperation({ summary: 'Get pixel script code' })
  async getPixelScript(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pixelId') pixelId: string,
  ) {
    const pixel = await this.pixelsService.getPixel(user.tenantId, pixelId);
    const script = this.pixelsService.getPixelScript({
      provider: pixel.provider as any,
      pixelId: pixel.pixelId,
      events: pixel.events as string[],
    });
    return { script };
  }

  // ==========================================================================
  // WEBHOOKS
  // ==========================================================================

  @Get('webhooks')
  @RequirePermissions(Permission.STORE_READ)
  @ApiOperation({ summary: 'Get all webhooks' })
  async getWebhooks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.webhooksService.getWebhooks(user.tenantId, storeId);
  }

  @Get('webhooks/:webhookId')
  @RequirePermissions(Permission.STORE_READ)
  @ApiOperation({ summary: 'Get webhook by ID' })
  async getWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooksService.getWebhook(user.tenantId, webhookId);
  }

  @Post('webhooks')
  @RequirePermissions(Permission.STORE_UPDATE)
  @ApiOperation({ summary: 'Create webhook' })
  @ApiResponse({ status: 201, description: 'Webhook created' })
  async createWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooksService.createWebhook(user.tenantId, storeId, dto);
  }

  @Patch('webhooks/:webhookId')
  @RequirePermissions(Permission.STORE_UPDATE)
  @ApiOperation({ summary: 'Update webhook' })
  async updateWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('webhookId') webhookId: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.updateWebhook(user.tenantId, webhookId, dto);
  }

  @Delete('webhooks/:webhookId')
  @RequirePermissions(Permission.STORE_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete webhook' })
  async deleteWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooksService.deleteWebhook(user.tenantId, webhookId);
  }

  @Post('webhooks/:webhookId/toggle')
  @RequirePermissions(Permission.STORE_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle webhook enabled/disabled' })
  async toggleWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('webhookId') webhookId: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.webhooksService.toggleWebhook(user.tenantId, webhookId, body.enabled);
  }

  @Post('webhooks/:webhookId/regenerate-secret')
  @RequirePermissions(Permission.STORE_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate webhook secret' })
  async regenerateWebhookSecret(
    @CurrentUser() user: AuthenticatedUser,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooksService.regenerateSecret(user.tenantId, webhookId);
  }

  @Post('webhooks/:webhookId/test')
  @RequirePermissions(Permission.STORE_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send test webhook' })
  async testWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooksService.testWebhook(user.tenantId, webhookId);
  }

  @Get('webhooks/:webhookId/deliveries')
  @RequirePermissions(Permission.STORE_READ)
  @ApiOperation({ summary: 'Get webhook delivery history' })
  async getWebhookDeliveries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('webhookId') webhookId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.webhooksService.getDeliveries(user.tenantId, webhookId, page || 1, limit || 20);
  }

  // ==========================================================================
  // APPS
  // ==========================================================================

  @Get('apps/catalog')
  @RequirePermissions(Permission.STORE_READ)
  @ApiOperation({ summary: 'Get available apps catalog' })
  async getAppsCatalog(@Query() query: AppsQueryDto) {
    return this.appsService.getAvailableApps(query.category);
  }

  @Get('apps/catalog/:appId')
  @RequirePermissions(Permission.STORE_READ)
  @ApiOperation({ summary: 'Get app details' })
  async getAppDetails(@Param('appId') appId: string) {
    return this.appsService.getAppDetails(appId);
  }

  @Get('apps')
  @RequirePermissions(Permission.STORE_READ)
  @ApiOperation({ summary: 'Get installed apps' })
  async getInstalledApps(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.appsService.getInstalledApps(user.tenantId, storeId);
  }

  @Get('apps/:installationId')
  @RequirePermissions(Permission.STORE_READ)
  @ApiOperation({ summary: 'Get installed app by ID' })
  async getInstalledApp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('installationId') installationId: string,
  ) {
    return this.appsService.getInstalledApp(user.tenantId, installationId);
  }

  @Post('apps')
  @RequirePermissions(Permission.STORE_UPDATE)
  @ApiOperation({ summary: 'Install an app' })
  @ApiResponse({ status: 201, description: 'App installed' })
  async installApp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: InstallAppDto,
  ) {
    return this.appsService.installApp(user.tenantId, storeId, dto.appId, dto.config, user.id);
  }

  @Patch('apps/:installationId')
  @RequirePermissions(Permission.STORE_UPDATE)
  @ApiOperation({ summary: 'Update app configuration' })
  async updateAppConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('installationId') installationId: string,
    @Body() dto: UpdateAppConfigDto,
  ) {
    return this.appsService.updateAppConfig(user.tenantId, installationId, dto.config);
  }

  @Post('apps/:installationId/toggle')
  @RequirePermissions(Permission.STORE_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle app enabled/disabled' })
  async toggleApp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('installationId') installationId: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.appsService.toggleApp(user.tenantId, installationId, body.enabled);
  }

  @Delete('apps/:installationId')
  @RequirePermissions(Permission.STORE_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Uninstall app' })
  async uninstallApp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('installationId') installationId: string,
  ) {
    return this.appsService.uninstallApp(user.tenantId, installationId);
  }

  // ==========================================================================
  // ANALYTICS INTEGRATIONS
  // ==========================================================================

  @Get('analytics')
  @RequirePermissions(Permission.STORE_READ)
  @ApiOperation({ summary: 'Get analytics integrations' })
  async getAnalyticsIntegrations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.appsService.getAnalyticsIntegrations(user.tenantId, storeId);
  }

  @Patch('analytics/:integrationId')
  @RequirePermissions(Permission.STORE_UPDATE)
  @ApiOperation({ summary: 'Update analytics integration' })
  async updateAnalyticsIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('integrationId') integrationId: string,
    @Body() body: { config: Record<string, unknown>; isEnabled?: boolean },
  ) {
    return this.appsService.updateAnalyticsIntegration(user.tenantId, integrationId, body.config, body.isEnabled);
  }

  @Delete('analytics/:integrationId')
  @RequirePermissions(Permission.STORE_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete analytics integration' })
  async deleteAnalyticsIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('integrationId') integrationId: string,
  ) {
    return this.appsService.deleteAnalyticsIntegration(user.tenantId, integrationId);
  }
}
