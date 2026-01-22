/**
 * Apps Service
 * Manages third-party app integrations
 */

import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { IntegrationsRepository } from './integrations.repository';
import { ErrorCode, App, AppCategory, AppStatus, AnalyticsProvider } from '@sellergo/types';

// Available apps catalog
const APPS_CATALOG: App[] = [
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    slug: 'google-analytics',
    description: 'Track and analyze your store traffic with Google Analytics 4. Get insights into visitor behavior, conversion rates, and more.',
    shortDescription: 'Website analytics and tracking',
    logo: { url: '/apps/google-analytics.png' },
    category: AppCategory.ANALYTICS,
    status: AppStatus.AVAILABLE,
    features: ['Page view tracking', 'E-commerce tracking', 'Conversion goals', 'Audience insights'],
    developer: 'Google',
    websiteUrl: 'https://analytics.google.com',
    requiredScopes: ['analytics_write'],
  },
  {
    id: 'google-tag-manager',
    name: 'Google Tag Manager',
    slug: 'google-tag-manager',
    description: 'Manage all your tracking tags in one place with Google Tag Manager. Deploy marketing tags without editing code.',
    shortDescription: 'Tag management system',
    logo: { url: '/apps/gtm.png' },
    category: AppCategory.ANALYTICS,
    status: AppStatus.AVAILABLE,
    features: ['Tag management', 'Trigger configuration', 'Version control', 'Preview mode'],
    developer: 'Google',
    websiteUrl: 'https://tagmanager.google.com',
    requiredScopes: ['analytics_write'],
  },
  {
    id: 'google-ads',
    name: 'Google Ads',
    slug: 'google-ads',
    description: 'Track conversions from your Google Ads campaigns. Measure ROI and optimize your advertising spend.',
    shortDescription: 'Conversion tracking for Google Ads',
    logo: { url: '/apps/google-ads.png' },
    category: AppCategory.MARKETING,
    status: AppStatus.AVAILABLE,
    features: ['Conversion tracking', 'Remarketing lists', 'Dynamic ads', 'Smart bidding'],
    developer: 'Google',
    websiteUrl: 'https://ads.google.com',
    requiredScopes: ['analytics_write'],
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    slug: 'google-sheets',
    description: 'Automatically sync orders to Google Sheets. Create custom reports and share data with your team.',
    shortDescription: 'Order sync to spreadsheets',
    logo: { url: '/apps/google-sheets.png' },
    category: AppCategory.PRODUCTIVITY,
    status: AppStatus.AVAILABLE,
    features: ['Auto sync orders', 'Custom columns', 'Real-time updates', 'Multiple sheets'],
    developer: 'Google',
    websiteUrl: 'https://sheets.google.com',
    requiredScopes: ['orders_read'],
  },
  {
    id: 'whatsapp-business',
    name: 'WhatsApp Business',
    slug: 'whatsapp-business',
    description: 'Send automated order notifications via WhatsApp. Keep customers informed about their orders.',
    shortDescription: 'WhatsApp order notifications',
    logo: { url: '/apps/whatsapp.png' },
    category: AppCategory.NOTIFICATIONS,
    status: AppStatus.AVAILABLE,
    features: ['Order confirmation', 'Shipping updates', 'Delivery notifications', 'Custom templates'],
    developer: 'Meta',
    websiteUrl: 'https://business.whatsapp.com',
    requiredScopes: ['notifications_write'],
  },
  {
    id: 'zapier',
    name: 'Zapier',
    slug: 'zapier',
    description: 'Connect your store to 5000+ apps. Automate workflows with no coding required.',
    shortDescription: 'No-code automation',
    logo: { url: '/apps/zapier.png' },
    category: AppCategory.AUTOMATION,
    status: AppStatus.AVAILABLE,
    features: ['5000+ integrations', 'Custom workflows', 'Multi-step zaps', 'Filters & paths'],
    developer: 'Zapier',
    websiteUrl: 'https://zapier.com',
    requiredScopes: ['webhooks_write'],
  },
  {
    id: 'shipping-integration',
    name: 'Shipping Integration',
    slug: 'shipping-integration',
    description: 'Integrate with local shipping carriers. Automatically generate shipping labels and track deliveries.',
    shortDescription: 'Local carrier integration',
    logo: { url: '/apps/shipping.png' },
    category: AppCategory.SHIPPING,
    status: AppStatus.COMING_SOON,
    features: ['Auto labels', 'Rate calculator', 'Delivery tracking', 'Multi-carrier support'],
    developer: 'Sellergo',
    requiredScopes: ['orders_write', 'shipping_write'],
  },
];

@Injectable()
export class AppsService {
  constructor(private readonly integrationsRepository: IntegrationsRepository) {}

  // Get available apps catalog
  async getAvailableApps(category?: AppCategory) {
    let apps = APPS_CATALOG;
    if (category) {
      apps = apps.filter(app => app.category === category);
    }
    return apps;
  }

  async getAppDetails(appId: string) {
    const app = APPS_CATALOG.find(a => a.id === appId);
    if (!app) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'App not found' });
    }
    return app;
  }

  // Get installed apps for a store
  async getInstalledApps(tenantId: string, storeId: string) {
    const installed = await this.integrationsRepository.getInstalledApps(tenantId, storeId);

    return installed.map((app: { appId: string; [key: string]: unknown }) => ({
      ...app,
      appDetails: APPS_CATALOG.find(a => a.id === app.appId),
    }));
  }

  async getInstalledApp(tenantId: string, installationId: string) {
    const app = await this.integrationsRepository.getInstalledAppById(tenantId, installationId);
    if (!app) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'App installation not found' });
    }
    return {
      ...app,
      appDetails: APPS_CATALOG.find(a => a.id === app.appId),
    };
  }

  // Install an app
  async installApp(tenantId: string, storeId: string, appId: string, config: Record<string, unknown>, userId: string) {
    const app = APPS_CATALOG.find(a => a.id === appId);
    if (!app) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'App not found' });
    }

    if (app.status === AppStatus.COMING_SOON) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'This app is coming soon' });
    }

    // Check if already installed
    const existing = await this.integrationsRepository.getInstalledAppByAppId(tenantId, storeId, appId);
    if (existing) {
      throw new ConflictException({ code: ErrorCode.VALIDATION_ERROR, message: 'App is already installed' });
    }

    // Validate config based on app type
    this.validateAppConfig(appId, config);

    // For analytics apps, also create the analytics integration
    if (app.category === AppCategory.ANALYTICS && ['google-analytics', 'google-tag-manager', 'google-ads'].includes(appId)) {
      await this.createAnalyticsIntegration(tenantId, storeId, appId, config);
    }

    return this.integrationsRepository.installApp(tenantId, storeId, {
      appId,
      appName: app.name,
      config,
      installedBy: userId,
    });
  }

  // Update app configuration
  async updateAppConfig(tenantId: string, installationId: string, config: Record<string, unknown>) {
    const installed = await this.getInstalledApp(tenantId, installationId);
    this.validateAppConfig(installed.appId, config);

    return this.integrationsRepository.updateInstalledApp(tenantId, installationId, {
      config,
      lastUsedAt: new Date(),
    });
  }

  // Toggle app enabled/disabled
  async toggleApp(tenantId: string, installationId: string, enabled: boolean) {
    await this.getInstalledApp(tenantId, installationId);
    return this.integrationsRepository.updateInstalledApp(tenantId, installationId, { isEnabled: enabled });
  }

  // Uninstall app
  async uninstallApp(tenantId: string, installationId: string) {
    await this.getInstalledApp(tenantId, installationId);
    await this.integrationsRepository.uninstallApp(tenantId, installationId);
    return { success: true };
  }

  // Analytics integrations
  async getAnalyticsIntegrations(tenantId: string, storeId: string) {
    return this.integrationsRepository.getAnalyticsIntegrations(tenantId, storeId);
  }

  async updateAnalyticsIntegration(tenantId: string, integrationId: string, config: Record<string, unknown>, isEnabled?: boolean) {
    const integration = await this.integrationsRepository.getAnalyticsIntegrationById(tenantId, integrationId);
    if (!integration) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Integration not found' });
    }

    const updates: Record<string, unknown> = { config };
    if (isEnabled !== undefined) updates.isEnabled = isEnabled;

    return this.integrationsRepository.updateAnalyticsIntegration(tenantId, integrationId, updates);
  }

  async deleteAnalyticsIntegration(tenantId: string, integrationId: string) {
    const integration = await this.integrationsRepository.getAnalyticsIntegrationById(tenantId, integrationId);
    if (!integration) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Integration not found' });
    }

    await this.integrationsRepository.deleteAnalyticsIntegration(tenantId, integrationId);
    return { success: true };
  }

  // Get integration status overview
  async getIntegrationStatus(tenantId: string, storeId: string) {
    return this.integrationsRepository.getIntegrationStatus(tenantId, storeId);
  }

  // Private helpers
  private validateAppConfig(appId: string, config: Record<string, unknown>) {
    switch (appId) {
      case 'google-analytics':
        if (!config.measurementId || typeof config.measurementId !== 'string') {
          throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Measurement ID is required' });
        }
        if (!config.measurementId.startsWith('G-')) {
          throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Invalid GA4 Measurement ID format' });
        }
        break;

      case 'google-tag-manager':
        if (!config.containerId || typeof config.containerId !== 'string') {
          throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Container ID is required' });
        }
        if (!config.containerId.startsWith('GTM-')) {
          throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Invalid GTM Container ID format' });
        }
        break;

      case 'google-ads':
        if (!config.conversionId || typeof config.conversionId !== 'string') {
          throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Conversion ID is required' });
        }
        break;

      case 'google-sheets':
        if (!config.spreadsheetId || typeof config.spreadsheetId !== 'string') {
          throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Spreadsheet ID is required' });
        }
        break;

      case 'whatsapp-business':
        if (!config.phoneNumberId || !config.accessToken) {
          throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Phone Number ID and Access Token are required' });
        }
        break;

      case 'zapier':
        if (!config.webhookUrl || typeof config.webhookUrl !== 'string') {
          throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Webhook URL is required' });
        }
        break;
    }
  }

  private async createAnalyticsIntegration(tenantId: string, storeId: string, appId: string, config: Record<string, unknown>) {
    const providerMap: Record<string, AnalyticsProvider> = {
      'google-analytics': AnalyticsProvider.GOOGLE_ANALYTICS,
      'google-tag-manager': AnalyticsProvider.GOOGLE_TAG_MANAGER,
      'google-ads': AnalyticsProvider.GOOGLE_ADS,
    };

    const provider = providerMap[appId];
    if (!provider) return;

    await this.integrationsRepository.createAnalyticsIntegration(tenantId, storeId, {
      provider,
      config,
    });
  }
}
