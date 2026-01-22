/**
 * Domains Controller
 */

import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DomainsService } from './domains.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { StoreGuard } from '../auth/guards/store.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Permission } from '@sellergo/types';
import { AddDomainDto } from './dto';

@ApiTags('Store Domains')
@Controller('stores/:storeId/domains')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
@ApiBearerAuth()
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  @RequirePermissions(Permission.SETTINGS_READ)
  @ApiOperation({ summary: 'Get store domains' })
  async getDomains(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string) {
    return this.domainsService.getDomains(user.tenantId, storeId);
  }

  @Post()
  @RequirePermissions(Permission.SETTINGS_UPDATE)
  @ApiOperation({ summary: 'Add custom domain' })
  async addDomain(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Body() dto: AddDomainDto) {
    return this.domainsService.addDomain(user.tenantId, storeId, dto.domain);
  }

  @Post(':domainId/verify')
  @RequirePermissions(Permission.SETTINGS_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify domain' })
  async verifyDomain(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string) {
    return this.domainsService.verifyDomain(user.tenantId, domainId);
  }

  @Patch(':domainId/primary')
  @RequirePermissions(Permission.SETTINGS_UPDATE)
  @ApiOperation({ summary: 'Set primary domain' })
  async setPrimaryDomain(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Param('domainId') domainId: string) {
    return this.domainsService.setPrimaryDomain(user.tenantId, storeId, domainId);
  }

  @Delete(':domainId')
  @RequirePermissions(Permission.SETTINGS_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete domain' })
  async deleteDomain(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string) {
    await this.domainsService.deleteDomain(user.tenantId, domainId);
  }
}
