/**
 * Store Guard
 * Ensures user has access to the requested store resources
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_STORE_CHECK_KEY } from '../decorators/skip-store-check.decorator';
import { DatabaseService } from '../../../core/database/database.service';

@Injectable()
export class StoreGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private databaseService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if store check should be skipped
    const skipStoreCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_STORE_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipStoreCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true; // Let auth guard handle this
    }

    // Get store ID from various sources
    const requestStoreId =
      request.params?.storeId ||
      request.query?.storeId ||
      request.body?.storeId ||
      request.headers['x-store-id'];

    // If no store ID in request, use user's default store
    if (!requestStoreId) {
      request.storeId = user.storeId;
      return true;
    }

    // Verify user has access to requested store
    const hasAccess = await this.verifyStoreAccess(
      user.id,
      user.tenantId,
      requestStoreId,
    );

    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this store');
    }

    request.storeId = requestStoreId;
    return true;
  }

  private async verifyStoreAccess(
    userId: string,
    tenantId: string,
    storeId: string,
  ): Promise<boolean> {
    const prisma = await this.databaseService.withTenant(tenantId);

    // Check if store exists and belongs to tenant
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        tenantId,
      },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    // Check if user is a member of the store
    const membership = await prisma.storeMember.findFirst({
      where: {
        userId,
        storeId,
        status: 'active',
      },
    });

    return !!membership;
  }
}
