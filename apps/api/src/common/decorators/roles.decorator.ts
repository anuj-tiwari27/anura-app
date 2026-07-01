import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@anura/shared';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles. Enforced by RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
