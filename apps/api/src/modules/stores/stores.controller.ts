/**
 * Stores Controller
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { StoreGuard } from '../auth/guards/store.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SkipStoreCheck } from '../auth/decorators/skip-store-check.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UserRole, Permission } from '@sellergo/types';
import {
  UpdateStoreDto,
  UpdateStoreSettingsDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
} from './dto';

@ApiTags('Stores')
@Controller('stores')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth()
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  /**
   * Get user's stores
   */
  @Get()
  @SkipStoreCheck()
  @ApiOperation({ summary: 'Get stores for current user' })
  @ApiResponse({ status: 200, description: 'List of stores' })
  async getStores(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.getStoresForUser(user.id);
  }

  /**
   * Get store by slug (public storefront)
   */
  @Get('by-slug/:slug')
  @Public()
  @SkipStoreCheck()
  @ApiOperation({ summary: 'Get store by slug (public)' })
  @ApiResponse({ status: 200, description: 'Store details' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  async getStoreBySlug(@Param('slug') slug: string) {
    return this.storesService.getStoreBySlug(slug);
  }

  /**
   * Get current store
   */
  @Get('current')
  @UseGuards(StoreGuard)
  @ApiOperation({ summary: 'Get current store details' })
  @ApiResponse({ status: 200, description: 'Store details' })
  async getCurrentStore(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.getStore(user.tenantId, user.storeId!);
  }

  /**
   * Get store by ID
   */
  @Get(':storeId')
  @UseGuards(StoreGuard)
  @ApiOperation({ summary: 'Get store by ID' })
  @ApiResponse({ status: 200, description: 'Store details' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  async getStore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.storesService.getStore(user.tenantId, storeId);
  }

  /**
   * Update store
   */
  @Patch(':storeId')
  @UseGuards(StoreGuard)
  @RequirePermissions(Permission.STORE_UPDATE)
  @ApiOperation({ summary: 'Update store' })
  @ApiResponse({ status: 200, description: 'Store updated' })
  async updateStore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.storesService.updateStore(user.tenantId, storeId, dto);
  }

  /**
   * Update store settings
   */
  @Patch(':storeId/settings')
  @UseGuards(StoreGuard)
  @RequirePermissions(Permission.SETTINGS_UPDATE)
  @ApiOperation({ summary: 'Update store settings' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: UpdateStoreSettingsDto,
  ) {
    return this.storesService.updateStoreSettings(user.tenantId, storeId, dto);
  }

  /**
   * Get store statistics
   */
  @Get(':storeId/statistics')
  @UseGuards(StoreGuard)
  @RequirePermissions(Permission.ANALYTICS_READ)
  @ApiOperation({ summary: 'Get store statistics' })
  @ApiResponse({ status: 200, description: 'Store statistics' })
  async getStatistics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.storesService.getStatistics(user.tenantId, storeId);
  }

  // Team management

  /**
   * Get store members
   */
  @Get(':storeId/members')
  @UseGuards(StoreGuard)
  @RequirePermissions(Permission.TEAM_READ)
  @ApiOperation({ summary: 'Get store team members' })
  @ApiResponse({ status: 200, description: 'Team members list' })
  async getMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.storesService.getMembers(user.tenantId, storeId);
  }

  /**
   * Invite member
   */
  @Post(':storeId/members/invite')
  @UseGuards(StoreGuard)
  @RequirePermissions(Permission.TEAM_INVITE)
  @ApiOperation({ summary: 'Invite team member' })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  async inviteMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.storesService.inviteMember(
      user.tenantId,
      storeId,
      dto.email,
      dto.role,
      user.id,
    );
  }

  /**
   * Accept invitation
   */
  @Post('invitations/:token/accept')
  @SkipStoreCheck()
  @ApiOperation({ summary: 'Accept team invitation' })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  async acceptInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string,
  ) {
    return this.storesService.acceptInvitation(token, user.id);
  }

  /**
   * Update member role
   */
  @Patch(':storeId/members/:memberId/role')
  @UseGuards(StoreGuard)
  @RequirePermissions(Permission.TEAM_UPDATE)
  @ApiOperation({ summary: 'Update member role' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  async updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.storesService.updateMemberRole(
      user.tenantId,
      storeId,
      memberId,
      dto.role,
      user.role as UserRole,
    );
  }

  /**
   * Remove member
   */
  @Delete(':storeId/members/:memberId')
  @UseGuards(StoreGuard)
  @RequirePermissions(Permission.TEAM_REMOVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove team member' })
  @ApiResponse({ status: 204, description: 'Member removed' })
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('memberId') memberId: string,
  ) {
    await this.storesService.removeMember(
      user.tenantId,
      storeId,
      memberId,
      user.id,
      user.role as UserRole,
    );
  }

  /**
   * Get pending invitations
   */
  @Get(':storeId/invitations')
  @UseGuards(StoreGuard)
  @RequirePermissions(Permission.TEAM_READ)
  @ApiOperation({ summary: 'Get pending invitations' })
  @ApiResponse({ status: 200, description: 'Pending invitations' })
  async getPendingInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.storesService.getPendingInvitations(user.tenantId, storeId);
  }

  /**
   * Cancel invitation
   */
  @Delete(':storeId/invitations/:invitationId')
  @UseGuards(StoreGuard)
  @RequirePermissions(Permission.TEAM_INVITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel invitation' })
  @ApiResponse({ status: 204, description: 'Invitation cancelled' })
  async cancelInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('invitationId') invitationId: string,
  ) {
    await this.storesService.cancelInvitation(user.tenantId, invitationId);
  }
}
