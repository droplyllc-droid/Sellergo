/**
 * Permissions Decorator
 * Specifies required permissions for accessing a route
 */

import { SetMetadata } from '@nestjs/common';
import { Permission } from '@sellergo/types';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
