/**
 * Integrations Repository
 */

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { PixelProvider, WebhookEvent, AnalyticsProvider } from '@sellergo/types';
import { randomBytes } from 'crypto';

export interface PaginationOptions {
  page: number;
  limit: number;
}

@Injectable()
export class IntegrationsRepository {
  constructor(private readonly db: DatabaseService) {}

  // ==========================================================================
  // AD PIXELS
  // ==========================================================================

  async getPixels(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.adPixel.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPixelById(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.adPixel.findUnique({ where: { id } });
  }

  async getPixelsByProvider(tenantId: string, storeId: string, provider: PixelProvider) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.adPixel.findMany({
      where: { storeId, provider, isEnabled: true },
    });
  }

  async createPixel(tenantId: string, storeId: string, data: {
    provider: PixelProvider;
    name: string;
    pixelId: string;
    accessToken?: string;
    testEventCode?: string;
    enableConversionsApi?: boolean;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.adPixel.create({
      data: {
        tenantId,
        storeId,
        provider: data.provider,
        name: data.name,
        pixelId: data.pixelId,
        accessToken: data.accessToken,
        testEventCode: data.testEventCode,
        isEnabled: true,
        enableConversionsApi: data.enableConversionsApi ?? false,
        events: ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase'],
      },
    });
  }

  async updatePixel(tenantId: string, id: string, data: Record<string, unknown>) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.adPixel.update({ where: { id }, data });
  }

  async deletePixel(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.adPixel.delete({ where: { id } });
  }

  // ==========================================================================
  // WEBHOOKS
  // ==========================================================================

  async getWebhooks(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.webhook.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWebhookById(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.webhook.findUnique({ where: { id } });
  }

  async getWebhooksByEvent(tenantId: string, storeId: string, event: WebhookEvent) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.webhook.findMany({
      where: {
        storeId,
        isEnabled: true,
        events: { has: event },
      },
    });
  }

  async createWebhook(tenantId: string, storeId: string, data: {
    name: string;
    url: string;
    events: WebhookEvent[];
    headers?: Record<string, string>;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    const secret = randomBytes(32).toString('hex');

    return prisma.webhook.create({
      data: {
        tenantId,
        storeId,
        name: data.name,
        url: data.url,
        secret,
        events: data.events,
        headers: data.headers || {},
        isEnabled: true,
        failureCount: 0,
      },
    });
  }

  async updateWebhook(tenantId: string, id: string, data: Record<string, unknown>) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.webhook.update({ where: { id }, data });
  }

  async deleteWebhook(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.webhook.delete({ where: { id } });
  }

  async recordWebhookTrigger(tenantId: string, id: string, status: number, success: boolean) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.webhook.update({
      where: { id },
      data: {
        lastTriggeredAt: new Date(),
        lastStatus: status,
        failureCount: success ? 0 : { increment: 1 },
      },
    });
  }

  async regenerateWebhookSecret(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    const newSecret = randomBytes(32).toString('hex');
    return prisma.webhook.update({
      where: { id },
      data: { secret: newSecret },
    });
  }

  // Webhook deliveries
  async createDelivery(tenantId: string, data: {
    webhookId: string;
    event: WebhookEvent;
    payload: Record<string, unknown>;
    attemptNumber: number;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.webhookDelivery.create({
      data: {
        tenantId,
        ...data,
        success: false,
      },
    });
  }

  async updateDelivery(tenantId: string, id: string, data: {
    responseStatus?: number;
    responseBody?: string;
    duration?: number;
    success?: boolean;
    errorMessage?: string;
    nextRetryAt?: Date;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.webhookDelivery.update({ where: { id }, data });
  }

  async getDeliveries(tenantId: string, webhookId: string, pagination: PaginationOptions) {
    const prisma = await this.db.withTenant(tenantId);
    const { page, limit } = pagination;

    const [items, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where: { webhookId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.webhookDelivery.count({ where: { webhookId } }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ==========================================================================
  // ANALYTICS INTEGRATIONS
  // ==========================================================================

  async getAnalyticsIntegrations(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.analyticsIntegration.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAnalyticsIntegrationById(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.analyticsIntegration.findUnique({ where: { id } });
  }

  async createAnalyticsIntegration(tenantId: string, storeId: string, data: {
    provider: AnalyticsProvider;
    config: Record<string, unknown>;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.analyticsIntegration.create({
      data: {
        tenantId,
        storeId,
        provider: data.provider,
        config: data.config,
        isEnabled: true,
      },
    });
  }

  async updateAnalyticsIntegration(tenantId: string, id: string, data: Record<string, unknown>) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.analyticsIntegration.update({ where: { id }, data });
  }

  async deleteAnalyticsIntegration(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.analyticsIntegration.delete({ where: { id } });
  }

  // ==========================================================================
  // INSTALLED APPS
  // ==========================================================================

  async getInstalledApps(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.installedApp.findMany({
      where: { storeId },
      orderBy: { installedAt: 'desc' },
    });
  }

  async getInstalledAppById(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.installedApp.findUnique({ where: { id } });
  }

  async getInstalledAppByAppId(tenantId: string, storeId: string, appId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.installedApp.findFirst({
      where: { storeId, appId },
    });
  }

  async installApp(tenantId: string, storeId: string, data: {
    appId: string;
    appName: string;
    config: Record<string, unknown>;
    installedBy: string;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.installedApp.create({
      data: {
        tenantId,
        storeId,
        appId: data.appId,
        appName: data.appName,
        isEnabled: true,
        config: data.config,
        installedBy: data.installedBy,
        installedAt: new Date(),
      },
    });
  }

  async updateInstalledApp(tenantId: string, id: string, data: Record<string, unknown>) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.installedApp.update({ where: { id }, data });
  }

  async uninstallApp(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.installedApp.delete({ where: { id } });
  }

  // ==========================================================================
  // INTEGRATION STATUS
  // ==========================================================================

  async getIntegrationStatus(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);

    const [pixels, analytics] = await Promise.all([
      prisma.adPixel.findMany({ where: { storeId, isEnabled: true } }),
      prisma.analyticsIntegration.findMany({ where: { storeId, isEnabled: true } }),
    ]);

    const pixelProviders = new Set(pixels.map((p: { provider: string }) => p.provider));
    const analyticsProviders = new Set(analytics.map((a: { provider: string }) => a.provider));

    return {
      googleAnalytics: analyticsProviders.has('google_analytics'),
      googleTagManager: analyticsProviders.has('google_tag_manager'),
      googleAds: analyticsProviders.has('google_ads'),
      metaPixel: pixelProviders.has('meta'),
      tiktokPixel: pixelProviders.has('tiktok'),
      snapchatPixel: pixelProviders.has('snapchat'),
      twitterPixel: pixelProviders.has('twitter'),
      pinterestTag: pixelProviders.has('pinterest'),
      totalActive: pixels.length + analytics.length,
      totalAvailable: 8, // Total supported integrations
    };
  }
}
