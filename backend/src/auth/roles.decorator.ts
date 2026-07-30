import { SetMetadata } from '@nestjs/common';

/**
 * @Roles('maintainer', 'admin', etc.) decorator for access control.
 * Used in conjunction with RolesGuard.
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
