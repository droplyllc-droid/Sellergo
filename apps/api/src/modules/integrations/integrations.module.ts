/**
 * Integrations Module
 */

import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsRepository } from './integrations.repository';
import { PixelsService } from './pixels.service';
import { WebhooksService } from './webhooks.service';
import { AppsService } from './apps.service';

@Module({
  controllers: [IntegrationsController],
  providers: [
    IntegrationsRepository,
    PixelsService,
    WebhooksService,
    AppsService,
  ],
  exports: [PixelsService, WebhooksService, AppsService],
})
export class IntegrationsModule {}
