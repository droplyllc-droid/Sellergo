/**
 * Webhooks Service
 * Manages webhooks for external integrations
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { IntegrationsRepository } from './integrations.repository';
import { QueueService } from '../../core/queue/queue.service';
import { ErrorCode, WebhookEvent, WebhookPayload } from '@sellergo/types';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly maxRetries = 3;
  private readonly retryDelays = [60000, 300000, 900000]; // 1min, 5min, 15min

  constructor(
    private readonly integrationsRepository: IntegrationsRepository,
    private readonly queueService: QueueService,
  ) {}

  async getWebhooks(tenantId: string, storeId: string) {
    return this.integrationsRepository.getWebhooks(tenantId, storeId);
  }

  async getWebhook(tenantId: string, webhookId: string) {
    const webhook = await this.integrationsRepository.getWebhookById(tenantId, webhookId);
    if (!webhook) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Webhook not found' });
    }
    return webhook;
  }

  async createWebhook(tenantId: string, storeId: string, dto: CreateWebhookDto) {
    return this.integrationsRepository.createWebhook(tenantId, storeId, dto);
  }

  async updateWebhook(tenantId: string, webhookId: string, dto: UpdateWebhookDto) {
    await this.getWebhook(tenantId, webhookId);
    return this.integrationsRepository.updateWebhook(tenantId, webhookId, dto);
  }

  async deleteWebhook(tenantId: string, webhookId: string) {
    await this.getWebhook(tenantId, webhookId);
    await this.integrationsRepository.deleteWebhook(tenantId, webhookId);
    return { success: true };
  }

  async toggleWebhook(tenantId: string, webhookId: string, enabled: boolean) {
    await this.getWebhook(tenantId, webhookId);
    return this.integrationsRepository.updateWebhook(tenantId, webhookId, { isEnabled: enabled });
  }

  async regenerateSecret(tenantId: string, webhookId: string) {
    await this.getWebhook(tenantId, webhookId);
    return this.integrationsRepository.regenerateWebhookSecret(tenantId, webhookId);
  }

  async getDeliveries(tenantId: string, webhookId: string, page = 1, limit = 20) {
    await this.getWebhook(tenantId, webhookId);
    return this.integrationsRepository.getDeliveries(tenantId, webhookId, { page, limit });
  }

  // Trigger webhook for an event
  async triggerEvent<T>(tenantId: string, storeId: string, event: WebhookEvent, data: T) {
    const webhooks = await this.integrationsRepository.getWebhooksByEvent(tenantId, storeId, event);

    for (const webhook of webhooks) {
      const payload: WebhookPayload<T> = {
        event,
        timestamp: new Date().toISOString(),
        data,
        storeId,
        webhookId: webhook.id,
      };

      // Queue the webhook delivery
      await this.queueService.addJob('webhook', 'deliver', {
        tenantId,
        webhookId: webhook.id,
        url: webhook.url,
        secret: webhook.secret,
        headers: webhook.headers,
        payload,
        attemptNumber: 1,
      });
    }
  }

  // Deliver webhook (called by queue worker)
  async deliverWebhook(
    tenantId: string,
    webhookId: string,
    url: string,
    secret: string,
    headers: Record<string, string>,
    payload: WebhookPayload,
    attemptNumber: number,
  ) {
    const delivery = await this.integrationsRepository.createDelivery(tenantId, {
      webhookId,
      event: payload.event,
      payload: payload as unknown as Record<string, unknown>,
      attemptNumber,
    });

    const signature = this.generateSignature(payload, secret);
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sellergo-Signature': signature,
          'X-Sellergo-Event': payload.event,
          'X-Sellergo-Delivery': delivery.id,
          ...headers,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const duration = Date.now() - startTime;
      const responseBody = await response.text().catch(() => '');

      const success = response.ok;

      await this.integrationsRepository.updateDelivery(tenantId, delivery.id, {
        responseStatus: response.status,
        responseBody: responseBody.substring(0, 1000), // Limit stored response
        duration,
        success,
        errorMessage: success ? undefined : `HTTP ${response.status}`,
      });

      await this.integrationsRepository.recordWebhookTrigger(tenantId, webhookId, response.status, success);

      if (!success && attemptNumber < this.maxRetries) {
        // Schedule retry
        const delay = this.retryDelays[attemptNumber - 1] || this.retryDelays[this.retryDelays.length - 1];
        const nextRetryAt = new Date(Date.now() + delay);

        await this.integrationsRepository.updateDelivery(tenantId, delivery.id, {
          nextRetryAt,
        });

        await this.queueService.addJob('webhook', 'deliver', {
          tenantId,
          webhookId,
          url,
          secret,
          headers,
          payload,
          attemptNumber: attemptNumber + 1,
        }, { delay });
      }

      return { success, status: response.status, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.integrationsRepository.updateDelivery(tenantId, delivery.id, {
        duration,
        success: false,
        errorMessage,
      });

      await this.integrationsRepository.recordWebhookTrigger(tenantId, webhookId, 0, false);

      // Schedule retry if not max attempts
      if (attemptNumber < this.maxRetries) {
        const delay = this.retryDelays[attemptNumber - 1] || this.retryDelays[this.retryDelays.length - 1];

        await this.queueService.addJob('webhook', 'deliver', {
          tenantId,
          webhookId,
          url,
          secret,
          headers,
          payload,
          attemptNumber: attemptNumber + 1,
        }, { delay });
      }

      this.logger.error(`Webhook delivery failed: ${errorMessage}`, { webhookId, url, attemptNumber });

      return { success: false, error: errorMessage, duration };
    }
  }

  // Test webhook
  async testWebhook(tenantId: string, webhookId: string) {
    const webhook = await this.getWebhook(tenantId, webhookId);

    const testPayload: WebhookPayload = {
      event: WebhookEvent.ORDER_CREATED,
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook delivery',
        orderId: 'test-order-123',
        orderNumber: 'TEST-001',
      },
      storeId: webhook.storeId,
      webhookId: webhook.id,
    };

    const signature = this.generateSignature(testPayload, webhook.secret);
    const startTime = Date.now();

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sellergo-Signature': signature,
          'X-Sellergo-Event': testPayload.event,
          'X-Sellergo-Delivery': 'test',
          ...(webhook.headers as Record<string, string>),
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(30000),
      });

      const duration = Date.now() - startTime;
      const responseBody = await response.text().catch(() => '');

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        duration,
        responseBody: responseBody.substring(0, 500),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  // Generate HMAC signature
  private generateSignature(payload: unknown, secret: string): string {
    const body = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
  }

  // Verify incoming webhook signature (for receiving webhooks from external services)
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }
}
