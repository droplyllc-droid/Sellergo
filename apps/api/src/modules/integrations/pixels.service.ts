/**
 * Pixels Service
 * Manages ad pixels (Meta, TikTok, Snapchat, etc.)
 */

import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationsRepository } from './integrations.repository';
import { QueueService } from '../../core/queue/queue.service';
import { ErrorCode, PixelProvider, PixelEvent, PixelEventData } from '@sellergo/types';
import { CreatePixelDto, UpdatePixelDto } from './dto';
import * as crypto from 'crypto';

@Injectable()
export class PixelsService {
  private readonly logger = new Logger(PixelsService.name);

  constructor(
    private readonly integrationsRepository: IntegrationsRepository,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
  ) {}

  async getPixels(tenantId: string, storeId: string) {
    return this.integrationsRepository.getPixels(tenantId, storeId);
  }

  async getPixel(tenantId: string, pixelId: string) {
    const pixel = await this.integrationsRepository.getPixelById(tenantId, pixelId);
    if (!pixel) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Pixel not found' });
    }
    return pixel;
  }

  async createPixel(tenantId: string, storeId: string, dto: CreatePixelDto) {
    // Check for existing pixel with same provider and pixelId
    const existingPixels = await this.integrationsRepository.getPixelsByProvider(tenantId, storeId, dto.provider);
    if (existingPixels.some(p => p.pixelId === dto.pixelId)) {
      throw new ConflictException({ code: ErrorCode.VALIDATION_ERROR, message: 'Pixel ID already exists for this provider' });
    }

    return this.integrationsRepository.createPixel(tenantId, storeId, dto);
  }

  async updatePixel(tenantId: string, pixelId: string, dto: UpdatePixelDto) {
    await this.getPixel(tenantId, pixelId);
    return this.integrationsRepository.updatePixel(tenantId, pixelId, dto);
  }

  async deletePixel(tenantId: string, pixelId: string) {
    await this.getPixel(tenantId, pixelId);
    await this.integrationsRepository.deletePixel(tenantId, pixelId);
    return { success: true };
  }

  async togglePixel(tenantId: string, pixelId: string, enabled: boolean) {
    await this.getPixel(tenantId, pixelId);
    return this.integrationsRepository.updatePixel(tenantId, pixelId, { isEnabled: enabled });
  }

  // Fire pixel events
  async fireEvent(tenantId: string, storeId: string, eventData: PixelEventData) {
    const pixels = await this.integrationsRepository.getPixels(tenantId, storeId);
    const enabledPixels = pixels.filter(p => p.isEnabled);

    for (const pixel of enabledPixels) {
      // Check if this event is enabled for this pixel
      if (!pixel.events.includes(eventData.eventName)) continue;

      // Queue the event for processing
      await this.queueService.addJob('pixel', 'fire-event', {
        pixelId: pixel.id,
        provider: pixel.provider,
        pixelIdentifier: pixel.pixelId,
        accessToken: pixel.accessToken,
        testEventCode: pixel.testEventCode,
        enableConversionsApi: pixel.enableConversionsApi,
        eventData,
      });
    }
  }

  // Send event via Conversions API
  async sendConversionsApiEvent(
    provider: PixelProvider,
    pixelId: string,
    accessToken: string,
    eventData: PixelEventData,
    testEventCode?: string,
  ) {
    switch (provider) {
      case PixelProvider.META:
        return this.sendMetaConversionsApiEvent(pixelId, accessToken, eventData, testEventCode);
      case PixelProvider.TIKTOK:
        return this.sendTikTokConversionsApiEvent(pixelId, accessToken, eventData, testEventCode);
      case PixelProvider.SNAPCHAT:
        return this.sendSnapchatConversionsApiEvent(pixelId, accessToken, eventData, testEventCode);
      default:
        this.logger.warn(`Conversions API not implemented for provider: ${provider}`);
        return null;
    }
  }

  private async sendMetaConversionsApiEvent(
    pixelId: string,
    accessToken: string,
    eventData: PixelEventData,
    testEventCode?: string,
  ) {
    const url = `https://graph.facebook.com/v18.0/${pixelId}/events`;

    const hashedUserData: Record<string, string> = {};
    if (eventData.userData?.email) {
      hashedUserData.em = this.hashValue(eventData.userData.email.toLowerCase().trim());
    }
    if (eventData.userData?.phone) {
      hashedUserData.ph = this.hashValue(eventData.userData.phone.replace(/\D/g, ''));
    }
    if (eventData.userData?.firstName) {
      hashedUserData.fn = this.hashValue(eventData.userData.firstName.toLowerCase().trim());
    }
    if (eventData.userData?.lastName) {
      hashedUserData.ln = this.hashValue(eventData.userData.lastName.toLowerCase().trim());
    }
    if (eventData.userData?.city) {
      hashedUserData.ct = this.hashValue(eventData.userData.city.toLowerCase().replace(/\s/g, ''));
    }
    if (eventData.userData?.country) {
      hashedUserData.country = this.hashValue(eventData.userData.country.toLowerCase());
    }

    const payload = {
      data: [{
        event_name: eventData.eventName,
        event_time: Math.floor(eventData.timestamp / 1000),
        event_id: eventData.eventId,
        event_source_url: eventData.sourceUrl,
        action_source: 'website',
        user_data: {
          ...hashedUserData,
          client_ip_address: eventData.ipAddress,
          client_user_agent: eventData.userAgent,
        },
        custom_data: eventData.customData ? {
          currency: eventData.customData.currency,
          value: eventData.customData.value,
          content_ids: eventData.customData.contentIds,
          content_type: eventData.customData.contentType,
          content_name: eventData.customData.contentName,
          num_items: eventData.customData.numItems,
          order_id: eventData.customData.orderId,
        } : undefined,
      }],
      access_token: accessToken,
      test_event_code: testEventCode,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      this.logger.debug(`Meta Conversions API response: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`Meta Conversions API error: ${error}`);
      throw error;
    }
  }

  private async sendTikTokConversionsApiEvent(
    pixelId: string,
    accessToken: string,
    eventData: PixelEventData,
    testEventCode?: string,
  ) {
    const url = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

    const eventMap: Record<string, string> = {
      PageView: 'Pageview',
      ViewContent: 'ViewContent',
      AddToCart: 'AddToCart',
      InitiateCheckout: 'InitiateCheckout',
      Purchase: 'CompletePayment',
    };

    const payload = {
      pixel_code: pixelId,
      event: eventMap[eventData.eventName] || eventData.eventName,
      event_id: eventData.eventId,
      timestamp: new Date(eventData.timestamp).toISOString(),
      context: {
        page: {
          url: eventData.sourceUrl,
        },
        user: {
          email: eventData.userData?.email ? this.hashValue(eventData.userData.email.toLowerCase()) : undefined,
          phone: eventData.userData?.phone ? this.hashValue(eventData.userData.phone) : undefined,
        },
        ip: eventData.ipAddress,
        user_agent: eventData.userAgent,
      },
      properties: eventData.customData ? {
        currency: eventData.customData.currency,
        value: eventData.customData.value,
        contents: eventData.customData.contentIds?.map(id => ({ content_id: id })),
        content_type: eventData.customData.contentType,
        order_id: eventData.customData.orderId,
      } : undefined,
      test_event_code: testEventCode,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Token': accessToken,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      this.logger.debug(`TikTok Events API response: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`TikTok Events API error: ${error}`);
      throw error;
    }
  }

  private async sendSnapchatConversionsApiEvent(
    pixelId: string,
    accessToken: string,
    eventData: PixelEventData,
    testEventCode?: string,
  ) {
    const url = `https://tr.snapchat.com/v2/conversion`;

    const eventMap: Record<string, string> = {
      PageView: 'PAGE_VIEW',
      ViewContent: 'VIEW_CONTENT',
      AddToCart: 'ADD_CART',
      InitiateCheckout: 'START_CHECKOUT',
      Purchase: 'PURCHASE',
    };

    const payload = {
      pixel_id: pixelId,
      event_type: eventMap[eventData.eventName] || eventData.eventName,
      event_conversion_type: 'WEB',
      timestamp: Math.floor(eventData.timestamp / 1000).toString(),
      event_tag: eventData.eventId,
      page_url: eventData.sourceUrl,
      hashed_email: eventData.userData?.email ? this.hashValue(eventData.userData.email.toLowerCase()) : undefined,
      hashed_phone_number: eventData.userData?.phone ? this.hashValue(eventData.userData.phone) : undefined,
      ip_address: eventData.ipAddress,
      user_agent: eventData.userAgent,
      price: eventData.customData?.value,
      currency: eventData.customData?.currency,
      item_ids: eventData.customData?.contentIds,
      transaction_id: eventData.customData?.orderId,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      this.logger.debug(`Snapchat Conversions API response: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`Snapchat Conversions API error: ${error}`);
      throw error;
    }
  }

  private hashValue(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  // Generate client-side pixel code
  getPixelScript(pixel: {
    provider: PixelProvider;
    pixelId: string;
    events: string[];
  }): string {
    switch (pixel.provider) {
      case PixelProvider.META:
        return this.getMetaPixelScript(pixel.pixelId);
      case PixelProvider.TIKTOK:
        return this.getTikTokPixelScript(pixel.pixelId);
      case PixelProvider.SNAPCHAT:
        return this.getSnapchatPixelScript(pixel.pixelId);
      case PixelProvider.TWITTER:
        return this.getTwitterPixelScript(pixel.pixelId);
      case PixelProvider.PINTEREST:
        return this.getPinterestTagScript(pixel.pixelId);
      default:
        return '';
    }
  }

  private getMetaPixelScript(pixelId: string): string {
    return `
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
</script>
<!-- End Meta Pixel Code -->`;
  }

  private getTikTokPixelScript(pixelId: string): string {
    return `
<!-- TikTok Pixel Code -->
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
  ttq.load('${pixelId}');
  ttq.page();
}(window, document, 'ttq');
</script>
<!-- End TikTok Pixel Code -->`;
  }

  private getSnapchatPixelScript(pixelId: string): string {
    return `
<!-- Snapchat Pixel Code -->
<script type='text/javascript'>
(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function()
{a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};
a.queue=[];var s='script';r=t.createElement(s);r.async=!0;
r.src=n;var u=t.getElementsByTagName(s)[0];
u.parentNode.insertBefore(r,u);})(window,document,
'https://sc-static.net/scevent.min.js');
snaptr('init', '${pixelId}');
snaptr('track', 'PAGE_VIEW');
</script>
<!-- End Snapchat Pixel Code -->`;
  }

  private getTwitterPixelScript(pixelId: string): string {
    return `
<!-- Twitter Universal Website Tag Code -->
<script>
!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='//static.ads-twitter.com/uwt.js',
a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
twq('init','${pixelId}');
twq('track','PageView');
</script>
<!-- End Twitter Universal Website Tag Code -->`;
  }

  private getPinterestTagScript(pixelId: string): string {
    return `
<!-- Pinterest Tag -->
<script>
!function(e){if(!window.pintrk){window.pintrk = function () {
window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var
  n=window.pintrk;n.queue=[],n.version="3.0";var
  t=document.createElement("script");t.async=!0,t.src=e;var
  r=document.getElementsByTagName("script")[0];
  r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load', '${pixelId}');
pintrk('page');
</script>
<!-- End Pinterest Tag -->`;
  }
}
