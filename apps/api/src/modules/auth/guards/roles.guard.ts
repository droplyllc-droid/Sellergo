/**
 * Roles Guard for RBAC
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, ROLE_PERMISSIONS, Permission } from '@sellergo/types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Get required permissions
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles or permissions required, allow access
    if (!requiredRoles?.length && !requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check roles
    if (requiredRoles?.length) {
      const hasRole = requiredRoles.includes(user.role as UserRole);
      if (!hasRole) {
        throw new ForbiddenException('Insufficient role permissions');
      }
    }

    // Check permissions
    if (requiredPermissions?.length) {
      const userPermissions = user.permissions || [];

      // If user has a role, also include role permissions
      if (user.role && ROLE_PERMISSIONS[user.role as UserRole]) {
        const rolePermissions = ROLE_PERMISSIONS[user.role as UserRole];
        userPermissions.push(...rolePermissions);
      }

      const hasAllPermissions = requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );

      if (!hasAllPermissions) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return true;
  }
}
