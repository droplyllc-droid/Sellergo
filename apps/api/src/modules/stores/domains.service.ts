/**
 * Domains Service
 * Business logic for store domain management
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StoresRepository } from './stores.repository';
import { QueueService } from '../../core/queue/queue.service';
import { ErrorCode } from '@sellergo/types';
import * as crypto from 'crypto';
import * as dns from 'dns/promises';

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);
  private readonly baseDomain: string;

  constructor(
    private readonly storesRepository: StoresRepository,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
  ) {
    this.baseDomain = this.configService.get<string>('app.baseDomain', 'sellergo.shop');
  }

  /**
   * Get store domains
   */
  async getDomains(tenantId: string, storeId: string) {
    return this.storesRepository.getDomains(tenantId, storeId);
  }

  /**
   * Add custom domain
   */
  async addDomain(tenantId: string, storeId: string, domain: string) {
    if (!this.isValidDomain(domain)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid domain format',
      });
    }

    const existingStore = await this.storesRepository.findByCustomDomain(domain);
    if (existingStore) {
      throw new ConflictException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Domain is already in use',
      });
    }

    const verificationToken = crypto.randomBytes(16).toString('hex');

    const storeDomain = await this.storesRepository.addDomain({
      tenantId,
      storeId,
      domain,
      type: 'custom',
      verificationToken,
    });

    return {
      ...storeDomain,
      verificationRecords: this.getVerificationRecords(domain, verificationToken),
    };
  }

  getVerificationRecords(domain: string, token: string) {
    return {
      cname: { type: 'CNAME', name: domain, value: `stores.${this.baseDomain}` },
      txt: { type: 'TXT', name: `_sellergo-verification.${domain}`, value: `sellergo-verification=${token}` },
    };
  }

  async verifyDomain(tenantId: string, domainId: string) {
    const domains = await this.storesRepository.getDomains(tenantId, '');
    const domain = domains.find((d: { id: string; domain: string; isVerified: boolean; verificationToken: string | null }) => d.id === domainId);

    if (!domain) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Domain not found' });
    }

    if (domain.isVerified) {
      return { verified: true, message: 'Domain is already verified' };
    }

    const isVerified = await this.checkDnsRecords(domain.domain, domain.verificationToken!);

    if (!isVerified) {
      return { verified: false, message: 'DNS verification failed. Please check your DNS records.' };
    }

    await this.storesRepository.updateDomain(tenantId, domainId, { isVerified: true, verifiedAt: new Date() });
    await this.queueService.addJob('domain', 'provision-ssl', { domainId, domain: domain.domain });

    return { verified: true, message: 'Domain verified successfully' };
  }

  private async checkDnsRecords(domain: string, verificationToken: string): Promise<boolean> {
    try {
      const cnameRecords: string[] = await dns.resolveCname(domain).catch(() => [] as string[]);
      const hasCname = cnameRecords.some((r: string) => r.toLowerCase().includes(this.baseDomain.toLowerCase()));

      const txtRecords: string[][] = await dns.resolveTxt(`_sellergo-verification.${domain}`).catch(() => [] as string[][]);
      const hasTxt = txtRecords.some((records: string[]) => records.some((r: string) => r.includes(verificationToken)));

      return hasCname || hasTxt;
    } catch (error) {
      this.logger.warn(`DNS verification failed for ${domain}: ${error}`);
      return false;
    }
  }

  async setPrimaryDomain(tenantId: string, storeId: string, domainId: string) {
    const domains = await this.storesRepository.getDomains(tenantId, storeId);
    const domain = domains.find((d: { id: string; isVerified: boolean; isPrimary: boolean }) => d.id === domainId);

    if (!domain) throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Domain not found' });
    if (!domain.isVerified) throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Domain must be verified first' });

    const currentPrimary = domains.find((d: { isPrimary: boolean; id: string }) => d.isPrimary);
    if (currentPrimary) {
      await this.storesRepository.updateDomain(tenantId, currentPrimary.id, { isPrimary: false });
    }

    return this.storesRepository.updateDomain(tenantId, domainId, { isPrimary: true });
  }

  async deleteDomain(tenantId: string, domainId: string) {
    const domains = await this.storesRepository.getDomains(tenantId, '');
    const domain = domains.find((d: { id: string; type: string; isPrimary: boolean }) => d.id === domainId);

    if (!domain) throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Domain not found' });
    if (domain.type === 'subdomain') throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Cannot delete subdomain' });
    if (domain.isPrimary) throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Cannot delete primary domain' });

    return this.storesRepository.deleteDomain(tenantId, domainId);
  }

  private isValidDomain(domain: string): boolean {
    return /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/.test(domain.toLowerCase());
  }
}
