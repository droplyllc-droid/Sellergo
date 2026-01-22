/**
 * Tenant Guard
 * Ensures user has access to the requested tenant resources
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_TENANT_CHECK_KEY } from '../decorators/skip-tenant-check.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if tenant check should be skipped
    const skipTenantCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipTenantCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true; // Let auth guard handle this
    }

    // Get tenant ID from params or query
    const requestTenantId =
      request.params?.tenantId ||
      request.query?.tenantId ||
      request.body?.tenantId;

    // If no tenant ID in request, use user's tenant
    if (!requestTenantId) {
      // Set tenant context for downstream use
      request.tenantId = user.tenantId;
      return true;
    }

    // Verify user has access to requested tenant
    if (requestTenantId !== user.tenantId) {
      throw new ForbiddenException('Access denied to this tenant');
    }

    request.tenantId = requestTenantId;
    return true;
  }
}
