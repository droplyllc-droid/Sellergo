/**
 * Roles Decorator
 * Specifies required roles for accessing a route
 */

import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@sellergo/types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
